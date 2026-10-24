using System.Runtime.CompilerServices;
using Elastic.Clients.Elasticsearch;
using Fulfil.Domain;

namespace Fulfil.Search;

public sealed class ProductExport(ElasticsearchClient client)
{
    const int PageSize = 1000;
    const int MaxRows = 200_000;

    public async IAsyncEnumerable<Product> StreamAsync(string? q, [EnumeratorCancellation] CancellationToken ct)
    {
        var query = ProductSearch.BuildQuery(q);
        for (var offset = 0; offset < MaxRows; offset += PageSize)
        {
            var response = await client.SearchAsync<Product>(s => s
                .Indices(ProductIndex.Current)
                .Query(query)
                .From(offset)
                .Size(PageSize)
                .Sort(o => o.Field("sku", f => f.Order(SortOrder.Asc))), ct);
            if (!response.IsValidResponse) throw new InvalidOperationException($"Export failed: {response.DebugInformation}");

            if (response.Documents.Count == 0) yield break;
            foreach (var product in response.Documents)
                yield return product;
        }
    }
}
