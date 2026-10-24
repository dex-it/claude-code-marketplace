namespace Catalog.Worker.Pricing;

public sealed record PriceChangedEventArgs(string Sku, decimal OldPrice, decimal NewPrice);

public sealed class CatalogEvents
{
    public event EventHandler<PriceChangedEventArgs>? PriceChanged;

    public void RaisePriceChanged(string sku, decimal oldPrice, decimal newPrice) =>
        PriceChanged?.Invoke(this, new PriceChangedEventArgs(sku, oldPrice, newPrice));
}
