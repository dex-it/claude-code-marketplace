using Microsoft.EntityFrameworkCore;

namespace Shop;

public record ProductSalesRow(Guid ProductId, string Name, int SoldQty, decimal Revenue);

public class SalesReport
{
    private readonly ShopDbContext _db;
    private readonly ProductRepository _products;

    public SalesReport(ShopDbContext db, ProductRepository products)
    {
        _db = db;
        _products = products;
    }

    public async Task<List<ProductSalesRow>> Build(DateTime from, DateTime to, CancellationToken ct = default)
    {
        var products = await _products.GetAllAsync(ct);
        var items = await _db.OrderItems
            .Where(i => i.Order.CreatedAt >= from && i.Order.CreatedAt < to)
            .ToListAsync(ct);

        return products
            .Where(p => p.IsActive)
            .Select(p =>
            {
                var sold = items.Where(i => i.ProductId == p.Id).ToList();
                return new ProductSalesRow(p.Id, p.Name, sold.Sum(i => i.Qty), sold.Sum(i => i.Qty * i.Price));
            })
            .OrderByDescending(r => r.Revenue)
            .ToList();
    }
}
