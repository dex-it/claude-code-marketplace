using Elastic.Clients.Elasticsearch;

namespace Fulfil.Search;

public sealed class ReindexService(ElasticsearchClient client, ILogger<ReindexService> log)
{
    public async Task<string> RebuildAsync(CancellationToken ct)
    {
        var current = ProductIndex.Current;
        var target = $"products-v{DateTime.UtcNow:yyyyMMddHHmmss}";

        var create = await client.Indices.CreateAsync(target, ct);
        if (!create.IsValidResponse) throw new InvalidOperationException($"Index create failed: {create.DebugInformation}");

        var reindex = await client.ReindexAsync(r => r
            .Source(s => s.Indices(current))
            .Dest(d => d.Index(target))
            .WaitForCompletion(true), ct);
        if (!reindex.IsValidResponse || reindex.Failures?.Count > 0)
            throw new InvalidOperationException($"Reindex into {target} failed: {reindex.DebugInformation}");
        await client.Indices.RefreshAsync(target, ct);

        ProductIndex.Current = target;
        log.LogInformation("Search index switched from {Old} to {New}", current, target);
        return target;
    }
}
