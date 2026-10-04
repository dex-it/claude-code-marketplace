using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

/// <summary>
/// Read-only query service for orders/products. All methods use AsNoTracking
/// since results are for display/export, not for later SaveChanges.
/// </summary>
public class OrderQueries
{
    private readonly ShopDbContext _db;
    public OrderQueries(ShopDbContext db) => _db = db;

    /// <summary>
    /// (a) Карточка одного заказа: заказ + все его позиции и платежи.
    /// AsSplitQuery — чтобы Items и Payments не давали декартово произведение
    /// в одном SQL-запросе (для заказа с N позициями и M платежами обычный
    /// Include без split даёт N*M строк на клиенте).
    /// </summary>
    public Task<Order?> GetOrderCardAsync(Guid orderId) =>
        _db.Orders
            .AsNoTracking()
            .AsSplitQuery()
            .Include(o => o.Items)
            .Include(o => o.Payments)
            .FirstOrDefaultAsync(o => o.Id == orderId);

    /// <summary>
    /// (б) Все заказы клиента с позициями и платежами. У клиента бывают тысячи
    /// заказов, поэтому обязательно AsSplitQuery: без него объём передаваемых
    /// данных умножается на количество позиций/платежей в каждом заказе, что
    /// на тысячах заказов даёт кратный трафик и лишнюю нагрузку на Postgres.
    /// </summary>
    public Task<List<Order>> GetCustomerOrdersAsync(Guid customerId) =>
        _db.Orders
            .AsNoTracking()
            .AsSplitQuery()
            .Where(o => o.CustomerId == customerId)
            .Include(o => o.Items)
            .Include(o => o.Payments)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();

    /// <summary>
    /// (в) Продукт по SKU и (опционально) складу. Один и тот же SKU может
    /// существовать на разных складах, но на конкретном складе SKU уникален.
    /// Если склад передан — ищем точное совпадение (Sku, Warehouse).
    /// Если склад не передан (null/пусто) — ищем по одному SKU:
    ///   - если совпадение ровно одно (SKU есть только на одном складе) — возвращаем его;
    ///   - если совпадений несколько (SKU есть на разных складах) — это
    ///     неоднозначность, которую по одному SKU не разрешить, поэтому кидаем
    ///     InvalidOperationException с перечнем складов, чтобы вызывающий код
    ///     мог явно указать склад.
    /// </summary>
    public async Task<Product?> GetProductBySku(string sku, string? warehouse)
    {
        if (string.IsNullOrWhiteSpace(sku))
            throw new ArgumentException("SKU must not be empty.", nameof(sku));

        if (!string.IsNullOrWhiteSpace(warehouse))
        {
            return await _db.Products
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Sku == sku && p.Warehouse == warehouse);
        }

        var matches = await _db.Products
            .AsNoTracking()
            .Where(p => p.Sku == sku)
            .ToListAsync();

        if (matches.Count > 1)
        {
            var warehouses = string.Join(", ", matches.Select(p => p.Warehouse));
            throw new InvalidOperationException(
                $"SKU '{sku}' exists on multiple warehouses ({warehouses}); " +
                "warehouse must be specified to disambiguate.");
        }

        return matches.SingleOrDefault();
    }

    /// <summary>
    /// (г) Дата отгрузки последнего отгруженного заказа клиента.
    /// Возвращаемый тип не nullable по требованию, поэтому если у клиента нет
    /// ни одного отгруженного заказа (ShippedAt везде null), это ошибка вызова
    /// (нет корректного значения, которое можно было бы вернуть) —
    /// бросаем InvalidOperationException, а не подставляем DateTime.MinValue,
    /// чтобы вызывающий код не спутал "нет данных" с реальной датой.
    /// </summary>
    public async Task<DateTime> GetLastShippedDateAsync(Guid customerId)
    {
        var shippedAt = await _db.Orders
            .AsNoTracking()
            .Where(o => o.CustomerId == customerId && o.ShippedAt != null)
            .OrderByDescending(o => o.ShippedAt)
            .Select(o => o.ShippedAt)
            .FirstOrDefaultAsync();

        if (shippedAt is null)
            throw new InvalidOperationException(
                $"Customer '{customerId}' has no shipped orders.");

        return shippedAt.Value;
    }
}
