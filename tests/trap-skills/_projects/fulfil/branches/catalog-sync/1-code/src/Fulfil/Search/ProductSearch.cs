using Elastic.Clients.Elasticsearch;
using Elastic.Clients.Elasticsearch.Aggregations;
using Elastic.Clients.Elasticsearch.QueryDsl;
using Fulfil.Domain;

namespace Fulfil.Search;

public sealed record SearchRequest(string? Q, string? Category, decimal? MinPrice, decimal? MaxPrice, string? Sort, int Page);

public sealed record SearchResult(
    long Total,
    IReadOnlyList<Product> Items,
    IReadOnlyDictionary<string, long> Categories,
    decimal? MinPrice,
    decimal? MaxPrice);

public sealed class ProductSearch(ElasticsearchClient client)
{
    const int PageSize = 20;
    const int MaxPage = 50;

    public static Query BuildQuery(string? q) =>
        string.IsNullOrWhiteSpace(q)
            ? new MatchAllQuery()
            : new MultiMatchQuery
            {
                Query = q,
                Fields = new[] { "name^3", "name.en^3", "description", "description.en" },
            };

    public async Task<SearchResult> SearchAsync(SearchRequest request, CancellationToken ct)
    {
        var page = Math.Clamp(request.Page, 1, MaxPage);
        var filters = new List<Query>();
        if (!string.IsNullOrEmpty(request.Category))
            filters.Add(new TermQuery { Field = "category", Value = request.Category });
        if (request.MinPrice is not null || request.MaxPrice is not null)
            filters.Add(new NumberRangeQuery("price")
            {
                Gte = request.MinPrice is null ? null : (double)request.MinPrice,
                Lte = request.MaxPrice is null ? null : (double)request.MaxPrice,
            });

        var response = await client.SearchAsync<Product>(s =>
        {
            s.Indices(ProductIndex.Alias)
                .Query(new BoolQuery { Must = new[] { BuildQuery(request.Q) }, Filter = filters })
                .From((page - 1) * PageSize)
                .Size(PageSize)
                .Aggregations(a => a
                    .Add("categories", new TermsAggregation { Field = "category", Size = 50 })
                    .Add("price", new StatsAggregation { Field = "price" }));
            switch (request.Sort)
            {
                case "price_asc": s.Sort(o => o.Field("price", f => f.Order(SortOrder.Asc))); break;
                case "price_desc": s.Sort(o => o.Field("price", f => f.Order(SortOrder.Desc))); break;
                case "name": s.Sort(o => o.Field("name.keyword", f => f.Order(SortOrder.Asc))); break;
            }
        }, ct);
        if (!response.IsValidResponse) throw new InvalidOperationException($"Search failed: {response.DebugInformation}");

        var categories = response.Aggregations?.GetStringTerms("categories")?.Buckets
            .ToDictionary(b => b.Key.ToString(), b => b.DocCount) ?? new Dictionary<string, long>();
        var price = response.Aggregations?.GetStats("price");
        return new SearchResult(
            response.Total,
            response.Documents.ToList(),
            categories,
            price?.Min is { } min ? (decimal)min : null,
            price?.Max is { } max ? (decimal)max : null);
    }

    public async Task<Product?> FindByNameAsync(string name, CancellationToken ct)
    {
        var response = await client.SearchAsync<Product>(s => s
            .Indices(ProductIndex.Alias)
            .Query(new TermQuery { Field = "name.keyword", Value = name })
            .Size(1), ct);
        return response.Documents.FirstOrDefault();
    }
}
