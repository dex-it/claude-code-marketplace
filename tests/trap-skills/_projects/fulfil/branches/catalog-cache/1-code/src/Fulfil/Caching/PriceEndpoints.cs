namespace Fulfil.Caching;

public sealed record PriceChanged(string Sku);

public static class PriceEndpoints
{
    public static IEndpointRouteBuilder MapPriceEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/products/{sku}/price", async (string sku, PriceCache cache, CancellationToken ct) =>
            Results.Ok(new { sku, price = await cache.GetAsync(sku, ct) }));

        app.MapPost("/internal/price-changed", (PriceChanged body, ILogger<PriceCache> log) =>
        {
            log.LogInformation("Price changed for {Sku}", body.Sku);
            return Results.Accepted();
        });
        return app;
    }
}
