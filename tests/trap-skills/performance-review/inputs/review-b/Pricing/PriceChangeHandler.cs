using Catalog.Worker.Data;
using Microsoft.EntityFrameworkCore;

namespace Catalog.Worker.Pricing;

public sealed class PriceChangeHandler(CatalogDbContext db, ILogger logger)
{
    private readonly List<PriceChangedEventArgs> _applied = [];

    public void OnPriceChanged(object? sender, PriceChangedEventArgs e)
    {
        db.Products
            .Where(p => p.Sku == e.Sku)
            .ExecuteUpdate(s => s.SetProperty(p => p.Price, e.NewPrice));
        _applied.Add(e);
        logger.LogInformation("Price {Sku}: {Old} -> {New}", e.Sku, e.OldPrice, e.NewPrice);
    }
}
