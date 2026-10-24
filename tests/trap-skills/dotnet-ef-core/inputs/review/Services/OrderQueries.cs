namespace Shop.Data.Services;

public class OrderQueries
{
    private readonly ShopDbContext _db;
    public OrderQueries(ShopDbContext db) => _db = db;

    public Task<Order?> GetCard(Guid orderId) =>
        _db.Orders
            .Include(o => o.Items)
            .Include(o => o.Payments)
            .AsSplitQuery()
            .AsNoTracking()
            .FirstOrDefaultAsync(o => o.Id == orderId);

    public Task<List<Order>> ExportForCustomer(Guid customerId) =>
        _db.Orders
            .Where(o => o.CustomerId == customerId)
            .Include(o => o.Items)
            .Include(o => o.Payments)
            .AsNoTracking()
            .ToListAsync();

    public Task<Product> GetProductBySku(string sku) =>
        _db.Products.AsNoTracking().SingleAsync(p => p.Sku == sku);

    public async Task<DateTime> LastShippedAt(Guid customerId)
    {
        var last = await _db.Orders
            .Where(o => o.CustomerId == customerId)
            .MaxAsync(o => o.ShippedAt);
        return last!.Value;
    }
}
