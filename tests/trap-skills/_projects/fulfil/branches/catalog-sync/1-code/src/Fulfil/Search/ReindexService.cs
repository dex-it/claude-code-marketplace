using Elastic.Clients.Elasticsearch;

namespace Fulfil.Search;

public sealed class ReindexService(ElasticsearchClient client, ProductIndexer indexer, ILogger<ReindexService> log)
{
    public async Task<string> RebuildAsync(CancellationToken ct)
    {
        var aliases = await client.Indices.GetAliasAsync((Names)ProductIndex.Alias, ct);
        var current = aliases.Aliases!.Keys.Single().ToString();
        var target = $"products-v{DateTime.UtcNow:yyyyMMddHHmmss}";

        await indexer.CreateIndexAsync(target, ct);
        var reindex = await client.ReindexAsync(r => r
            .Source(s => s.Indices(current))
            .Dest(d => d.Index(target))
            .Slices(new Slices(SlicesCalculation.Auto))
            .WaitForCompletion(true), ct);
        if (!reindex.IsValidResponse || reindex.Failures?.Count > 0)
            throw new InvalidOperationException($"Reindex into {target} failed: {reindex.DebugInformation}");
        await client.Indices.RefreshAsync(target, ct);

        var swap = await client.Indices.UpdateAliasesAsync(u => u
            .Actions(a => a.Remove(x => x.Index(current).Alias(ProductIndex.Alias)),
                     a => a.Add(x => x.Index(target).Alias(ProductIndex.Alias))), ct);
        if (!swap.IsValidResponse) throw new InvalidOperationException($"Alias switch failed: {swap.DebugInformation}");

        log.LogInformation("Alias {Alias} moved from {Old} to {New}", ProductIndex.Alias, current, target);
        return target;
    }
}
