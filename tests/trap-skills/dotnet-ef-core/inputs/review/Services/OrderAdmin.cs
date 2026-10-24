namespace Shop.Data.Services;

public record OrderEdit(Guid Id, string Status, string Category);

public class OrderAdmin
{
    private readonly ShopDbContext _db;
    private readonly OrderRepository _repo;
    public OrderAdmin(ShopDbContext db, OrderRepository repo) { _db = db; _repo = repo; }

    public async Task UpdateOrder(OrderEdit edit)
    {
        var order = await _db.Orders.FirstAsync(o => o.Id == edit.Id);
        order.Status = edit.Status;
        order.Category = edit.Category;
        await _db.SaveChangesAsync();
    }

    public async Task RecalcTotal(Guid orderId)
    {
        var order = await _db.Orders.Include(o => o.Items).FirstAsync(o => o.Id == orderId);
        var ids = order.Items.Select(i => i.ProductId).ToList();
        var prices = await _db.Products.Where(p => ids.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, p => p.Price);
        order.Total = order.Items.Sum(i => prices[i.ProductId]);
        await _db.SaveChangesAsync();
    }

    public async Task<List<Guid>> OverdueReport(DateTime now)
    {
        var all = await _repo.GetAllAsync();
        return all.Where(o => o.IsOverdue(now)).Select(o => o.Id).ToList();
    }
}
