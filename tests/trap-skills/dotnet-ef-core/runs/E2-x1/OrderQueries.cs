using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

/// <summary>
/// Read-only запросы по заказам/товарам. Все выборки без трекинга (только для чтения).
/// </summary>
public class OrderQueries
{
    private readonly ShopDbContext _db;
    public OrderQueries(ShopDbContext db) => _db = db;

    /// <summary>
    /// (а) Карточка одного заказа: сам заказ + все его позиции и платежи.
    /// Order.HasQueryFilter(!IsDeleted) применяется автоматически - мягко удалённый заказ вернёт null.
    /// </summary>
    public Task<Order?> GetOrderCardAsync(Guid orderId, CancellationToken ct = default) =>
        _db.Orders
            .AsNoTracking()
            .Include(o => o.Items)
            .Include(o => o.Payments)
            .FirstOrDefaultAsync(o => o.Id == orderId, ct);

    /// <summary>
    /// (б) Все заказы клиента с позициями и платежами. У клиента бывают тысячи заказов, поэтому:
    /// - AsSplitQuery() - иначе Order x Items x Payments даёт декартово произведение строк в одном SQL-запросе;
    /// - результат отдаётся как IAsyncEnumerable, чтобы не держать тысячи заказов (и их позиций/платежей)
    ///   одним List в памяти - вызывающий код сам решает, буферизовать ли (ToListAsync) или стримить (await foreach).
    /// OrderBy нужен и для детерминированного порядка, и для устойчивой корреляции строк между отдельными
    /// запросами split query.
    /// </summary>
    public IAsyncEnumerable<Order> GetCustomerOrdersAsync(Guid customerId, CancellationToken ct = default) =>
        _db.Orders
            .AsNoTracking()
            .Where(o => o.CustomerId == customerId)
            .OrderBy(o => o.CreatedAt)
            .Include(o => o.Items)
            .Include(o => o.Payments)
            .AsSplitQuery()
            .AsAsyncEnumerable();

    /// <summary>
    /// (в) Продукт по SKU и (опционально) складу. Один SKU может лежать на нескольких складах,
    /// в рамках одного склада SKU уникален. Бизнес сейчас иногда не передаёт склад (null/пусто):
    /// в этом случае метод не угадывает склад через FirstOrDefault, а явно разбирает, сколько
    /// строк с таким SKU есть - 0 / 1 / несколько.
    /// </summary>
    public async Task<Product?> GetProductBySkuAsync(string sku, string? warehouse, CancellationToken ct = default)
    {
        var bySku = _db.Products.AsNoTracking().Where(p => p.Sku == sku);

        if (!string.IsNullOrEmpty(warehouse))
        {
            // Sku+Warehouse уникальны вместе - можно смело SingleOrDefaultAsync.
            return await bySku.SingleOrDefaultAsync(p => p.Warehouse == warehouse, ct);
        }

        // Склад не передан: складов у одного SKU немного (не тысячи), поэтому забираем кандидатов
        // и разруливаем неоднозначность в коде, а не молча берём первый попавшийся.
        var candidates = await bySku.ToListAsync(ct);
        return candidates.Count switch
        {
            0 => null,
            1 => candidates[0],
            _ => throw new InvalidOperationException(
                $"SKU '{sku}' найден на {candidates.Count} складах ({string.Join(", ", candidates.Select(p => p.Warehouse))}); " +
                "нужно передать конкретный склад.")
        };
    }

    /// <summary>
    /// (г) Дата отгрузки последнего отгруженного заказа клиента.
    /// ShippedAt не имеет явного HasColumnType в OnModelCreating, поэтому в Npgsql 8 (>=6) это `timestamptz`,
    /// и значение, приходящее из Postgres, уже DateTimeKind.Utc - конвертировать Kind вручную не нужно
    /// (в отличие от CreatedAt, которому явно задан `timestamp without time zone`).
    /// Возврат нужен non-nullable DateTime: если у клиента ещё нет ни одного отгруженного заказа,
    /// это исключительная ситуация для вызывающего кода, а не "0001-01-01" по умолчанию.
    /// </summary>
    public async Task<DateTime> GetLastShipDateAsync(Guid customerId, CancellationToken ct = default)
    {
        var shippedOrders = _db.Orders
            .AsNoTracking()
            .Where(o => o.CustomerId == customerId && o.ShippedAt != null);

        // AnyAsync вместо CountAsync() > 0 для проверки наличия.
        if (!await shippedOrders.AnyAsync(ct))
            throw new InvalidOperationException($"У клиента {customerId} нет отгруженных заказов.");

        var maxShippedAt = await shippedOrders.MaxAsync(o => o.ShippedAt, ct);
        return maxShippedAt!.Value;
    }
}
