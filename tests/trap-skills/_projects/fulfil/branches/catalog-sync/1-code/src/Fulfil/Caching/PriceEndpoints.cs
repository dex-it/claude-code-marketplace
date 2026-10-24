namespace Fulfil.Caching;

public sealed record PriceChanged(string Sku);

public static class PriceEndpoints
{
    public static IEndpointRouteBuilder MapPriceEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/products/{sku}/price", async (string sku, PriceCache cache, CancellationToken ct) =>
            Results.Ok(new { sku, price = await cache.GetAsync(sku, ct) }));

        app.MapPost("/internal/price-changed", async (PriceChanged body, PriceCache cache) =>
        {
            await cache.InvalidateAsync(body.Sku);
            return Results.NoContent();
        });
        return app;
    }
}
