using Elastic.Clients.Elasticsearch;
using Elastic.Clients.Elasticsearch.Mapping;
using Fulfil.Domain;
using Fulfil.Ports;

namespace Fulfil.Search;

public static class ProductIndex
{
    public static string Current { get; set; } = "products-v3";
}

public sealed class ProductIndexer(ElasticsearchClient client)
{
    public async Task EnsureAsync(CancellationToken ct)
    {
        var exists = await client.Indices.ExistsAsync(ProductIndex.Current, ct);
        if (!exists.Exists) await CreateIndexAsync(ProductIndex.Current, ct);
    }

    public async Task CreateIndexAsync(string name, CancellationToken ct)
    {
        var response = await client.Indices.CreateAsync(name, c => c
            .Mappings(m => m
                .Dynamic(DynamicMapping.Strict)
                .Properties<Product>(p => p
                    .Keyword(x => x.Sku)
                    .Text(x => x.Name)
                    .Text(x => x.Description)
                    .Text(x => x.Category, t => t.Fields(f => f.Keyword("keyword")))
                    .DoubleNumber(x => x.Price)
                    .IntegerNumber(x => x.Stock))), ct);
        if (!response.IsValidResponse) throw new InvalidOperationException($"Index create failed: {response.DebugInformation}");
    }

    public async Task<int> IndexAllAsync(ICatalogSource source, string index, CancellationToken ct)
    {
        var total = 0;
        await foreach (var product in source.ReadAllAsync(ct))
        {
            var response = await client.IndexAsync(product, index, product.Sku, ct);
            if (!response.IsValidResponse) throw new InvalidOperationException($"Indexing {product.Sku} failed: {response.DebugInformation}");
            total++;
        }
        return total;
    }

    public async Task IndexBatchAsync(IReadOnlyCollection<Product> products, string index, CancellationToken ct)
    {
        await client.BulkAsync(index, b => b.IndexMany(products, (op, p) => op.Id(p.Sku)), ct);
    }
}
