using Elastic.Clients.Elasticsearch;
using Fulfil.Domain;
using Fulfil.Options;
using Fulfil.Ports;
using Microsoft.Extensions.Options;

namespace Fulfil.Search;

public sealed class IndexBootstrap(ProductIndexer indexer, ILogger<IndexBootstrap> log) : IHostedService
{
    public async Task StartAsync(CancellationToken ct)
    {
        try
        {
            await indexer.EnsureAsync(ct);
        }
        catch (Exception ex)
        {
            log.LogError(ex, "Search index is not ready");
        }
    }

    public Task StopAsync(CancellationToken ct) => Task.CompletedTask;
}

public static class SearchEndpoints
{
    public static IServiceCollection AddProductSearch(this IServiceCollection services)
    {
        services.AddSingleton(sp =>
            new ElasticsearchClient(new Uri(sp.GetRequiredService<IOptions<FulfilOptions>>().Value.ElasticUri)));
        services.AddSingleton<ProductIndexer>();
        services.AddSingleton<ProductSearch>();
        services.AddSingleton<ProductExport>();
        services.AddSingleton<ReindexService>();
        services.AddHostedService<IndexBootstrap>();
        return services;
    }

    public static IEndpointRouteBuilder MapProductSearch(this IEndpointRouteBuilder app)
    {
        app.MapGet("/search", (string? q, string? category, decimal? minPrice, decimal? maxPrice, string? sort, int? page,
                ProductSearch search, CancellationToken ct) =>
            search.SearchAsync(new SearchRequest(q, category, minPrice, maxPrice, sort, page ?? 1), ct));

        app.MapGet("/search/export", (string? q, ProductExport export, CancellationToken ct) =>
            export.StreamAsync(q, ct));

        app.MapGet("/search/by-name", async (string name, ProductSearch search, CancellationToken ct) =>
            await search.FindByNameAsync(name, ct) is { } product ? Results.Ok(product) : Results.NotFound());

        app.MapPost("/internal/products", async (Product[] products, ProductIndexer indexer, CancellationToken ct) =>
        {
            await indexer.IndexBatchAsync(products, ProductIndex.Alias, ct);
            return Results.NoContent();
        });

        app.MapPost("/internal/catalog/load", async (ICatalogSource source, ProductIndexer indexer, CancellationToken ct) =>
            Results.Ok(new { indexed = await indexer.IndexAllAsync(source, ProductIndex.Alias, ct) }));

        app.MapPost("/internal/catalog/rebuild", async (ReindexService reindex, CancellationToken ct) =>
            Results.Ok(new { index = await reindex.RebuildAsync(ct) }));
        return app;
    }
}
