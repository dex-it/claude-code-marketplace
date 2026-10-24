using System.Runtime.CompilerServices;
using Elastic.Clients.Elasticsearch;
using Elastic.Clients.Elasticsearch.Core.Search;
using Fulfil.Domain;

namespace Fulfil.Search;

public sealed class ProductExport(ElasticsearchClient client)
{
    const int PageSize = 1000;
    const int MaxRows = 200_000;
    const string KeepAlive = "2m";

    public async IAsyncEnumerable<Product> StreamAsync(string? q, [EnumeratorCancellation] CancellationToken ct)
    {
        var pit = await client.OpenPointInTimeAsync(ProductIndex.Alias, r => r.KeepAlive(KeepAlive), ct);
        try
        {
            var query = ProductSearch.BuildQuery(q);
            ICollection<FieldValue>? after = null;
            var sent = 0;
            while (sent < MaxRows)
            {
                var response = await client.SearchAsync<Product>(s =>
                {
                    s.Pit(new PointInTimeReference { Id = pit.Id, KeepAlive = KeepAlive })
                        .Query(query)
                        .Size(PageSize)
                        .Sort(o => o.Field("sku", f => f.Order(SortOrder.Asc)));
                    if (after is not null) s.SearchAfter(after);
                }, ct);
                if (!response.IsValidResponse) throw new InvalidOperationException($"Export failed: {response.DebugInformation}");

                var hits = response.Hits;
                if (hits.Count == 0) yield break;
                foreach (var hit in hits)
                {
                    if (hit.Source is not null) yield return hit.Source;
                    sent++;
                }
                after = hits.Last().Sort?.ToList();
            }
        }
        finally
        {
            await client.ClosePointInTimeAsync(r => r.Id(pit.Id), CancellationToken.None);
        }
    }
}
