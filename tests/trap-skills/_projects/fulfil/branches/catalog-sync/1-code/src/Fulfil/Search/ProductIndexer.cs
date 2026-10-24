using Elastic.Clients.Elasticsearch;
using Elastic.Clients.Elasticsearch.Mapping;
using Fulfil.Domain;
using Fulfil.Ports;

namespace Fulfil.Search;

public static class ProductIndex
{
    public const string Alias = "products";
}

public sealed class ProductIndexer(ElasticsearchClient client, ILogger<ProductIndexer> log)
{
    const int BatchSize = 1000;

    public async Task EnsureAsync(CancellationToken ct)
    {
        var alias = await client.Indices.ExistsAliasAsync(ProductIndex.Alias, ct);
        if (alias.Exists) return;

        const string first = "products-v1";
        await CreateIndexAsync(first, ct);
        var put = await client.Indices.PutAliasAsync(first, ProductIndex.Alias, ct);
        if (!put.IsValidResponse) throw new InvalidOperationException($"Alias create failed: {put.DebugInformation}");
    }

    public async Task CreateIndexAsync(string name, CancellationToken ct)
    {
        var response = await client.Indices.CreateAsync(name, c => c
            .Mappings(m => m
                .Dynamic(DynamicMapping.Strict)
                .Properties<Product>(p => p
                    .Keyword(x => x.Sku)
                    .Text(x => x.Name, t => t
                        .Analyzer("russian")
                        .Fields(f => f
                            .Text("en", e => e.Analyzer("english"))
                            .Keyword("keyword")))
                    .Text(x => x.Description, t => t
                        .Analyzer("russian")
                        .Fields(f => f.Text("en", e => e.Analyzer("english"))))
                    .Keyword(x => x.Category)
                    .DoubleNumber(x => x.Price)
                    .IntegerNumber(x => x.Stock))), ct);
        if (!response.IsValidResponse) throw new InvalidOperationException($"Index create failed: {response.DebugInformation}");
    }

    public async Task<int> IndexAllAsync(ICatalogSource source, string index, CancellationToken ct)
    {
        var batch = new List<Product>(BatchSize);
        var total = 0;
        await foreach (var product in source.ReadAllAsync(ct))
        {
            batch.Add(product);
            if (batch.Count < BatchSize) continue;
            await IndexBatchAsync(batch, index, ct);
            total += batch.Count;
            batch.Clear();
        }
        if (batch.Count > 0)
        {
            await IndexBatchAsync(batch, index, ct);
            total += batch.Count;
        }
        return total;
    }

    public async Task IndexBatchAsync(IReadOnlyCollection<Product> products, string index, CancellationToken ct)
    {
        var response = await client.BulkAsync(index, b => b.IndexMany(products, (op, p) => op.Id(p.Sku)), ct);
        if (response.Errors)
        {
            foreach (var item in response.ItemsWithErrors.Take(5))
                log.LogWarning("Indexing {Id} failed: {Reason}", item.Id, item.Error?.Reason);
            throw new InvalidOperationException($"{response.ItemsWithErrors.Count()} of {products.Count} documents were rejected");
        }
    }
}
