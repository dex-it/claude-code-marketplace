using Microsoft.EntityFrameworkCore;

namespace Shop;

public record GeoPoint(double Lat, double Lon);

public class ShippingPlanner
{
    private readonly ShopDbContext _db;
    public ShippingPlanner(ShopDbContext db) => _db = db;

    public Task<Warehouse> DefaultWarehouse(CancellationToken ct = default) =>
        _db.Warehouses.FirstAsync(w => w.IsDefault, ct);

    public async Task<(Warehouse Warehouse, double AvgDeliveryDays)> ChooseWarehouse(
        Guid productId, int qty, GeoPoint customer, CancellationToken ct = default)
    {
        var withStock = await _db.StockItems
            .Where(s => s.ProductId == productId && s.Qty >= qty)
            .Select(s => s.WarehouseId)
            .ToListAsync(ct);

        var warehouses = await _db.Warehouses
            .Where(w => withStock.Contains(w.Id))
            .ToListAsync(ct);

        var nearest = warehouses
            .OrderBy(w => DistanceKm(customer, w.Lat, w.Lon))
            .First();

        var avgDays = await _db.Shipments
            .Where(s => s.WarehouseId == nearest.Id && s.DeliveryDays != null)
            .AverageAsync(s => s.DeliveryDays!.Value, ct);

        return (nearest, avgDays);
    }

    public static double DistanceKm(GeoPoint a, double lat, double lon)
    {
        const double R = 6371;
        var dLat = (lat - a.Lat) * Math.PI / 180;
        var dLon = (lon - a.Lon) * Math.PI / 180;
        var h = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(a.Lat * Math.PI / 180) * Math.Cos(lat * Math.PI / 180) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return 2 * R * Math.Asin(Math.Sqrt(h));
    }
}
