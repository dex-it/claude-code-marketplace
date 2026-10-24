namespace Shop.Data;

// Проекция для отчёта по активным заказам: имя клиента и число позиций
// достаются одним запросом (join + подсчёт по навигации), без подгрузки лишних данных.
public record ActiveOrderSummary(Guid OrderId, string CustomerName, decimal Total, int ItemsCount);

public class OrderRepository
{
    private readonly ShopDbContext _db;
    public OrderRepository(ShopDbContext db) => _db = db;
    public Task<List<Order>> GetAllAsync() => _db.Orders.ToListAsync();
    public Task<Order?> GetAsync(Guid id) => _db.Orders.FirstOrDefaultAsync(o => o.Id == id);

    // --- Запросы для страницы отчётов (только чтение, без трекинга) ---

    // а) Активные заказы: Id, имя клиента, Total, число позиций.
    public Task<List<ActiveOrderSummary>> GetActiveOrderSummariesAsync() =>
        _db.Orders
            .AsNoTracking()
            .Where(o => o.Status == "active")
            .Select(o => new ActiveOrderSummary(o.Id, o.Customer.Name, o.Total, o.Items.Count))
            .ToListAsync();

    // б) Число активных заказов по категориям.
    public Task<Dictionary<string, int>> GetActiveOrderCountsByCategoryAsync() =>
        _db.Orders
            .AsNoTracking()
            .Where(o => o.Status == "active")
            .GroupBy(o => o.Category)
            .Select(g => new { Category = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Category, x => x.Count);

    // в) Просроченные заказы на момент now.
    // Условие продублировано из Order.IsOverdue: метод экземпляра нельзя транслировать
    // в SQL напрямую, поэтому правило инлайнится вручную и должно обновляться вместе с ним.
    // CreatedAt хранится как "timestamp without time zone" (Kind=Unspecified), поэтому
    // параметр now нормализуется к Unspecified - иначе Npgsql бросит исключение при
    // сравнении DateTime с Kind=Utc с этой колонкой.
    public Task<List<Order>> GetOverdueOrdersAsync(DateTime now)
    {
        var threshold = DateTime.SpecifyKind(now, DateTimeKind.Unspecified);
        return _db.Orders
            .AsNoTracking()
            .Where(o => o.ShippedAt == null && o.CreatedAt.AddDays(3) < threshold)
            .ToListAsync();
    }
}
