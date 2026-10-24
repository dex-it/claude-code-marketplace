using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

/// <summary>
/// Read-only выборки по заказам/товарам поверх ShopDbContext.
/// Не отслеживает сущности (AsNoTracking) - предназначен только для чтения/выгрузки.
/// </summary>
public class OrderQueries
{
    private readonly ShopDbContext _db;
    public OrderQueries(ShopDbContext db) => _db = db;

    /// <summary>
    /// (а) Карточка одного заказа: сам заказ + все позиции (Items) и все платежи (Payments).
    /// AsSplitQuery() обязателен: Items и Payments - независимые коллекции одного заказа,
    /// одним JOIN-запросом строки перемножились бы (декартово произведение).
    /// </summary>
    public Task<Order?> GetOrderCardAsync(Guid orderId, CancellationToken ct = default) =>
        _db.Orders
            .AsNoTracking()
            .AsSplitQuery()
            .Include(o => o.Items)
            .Include(o => o.Payments)
            .FirstOrDefaultAsync(o => o.Id == orderId, ct);

    /// <summary>
    /// (б) Выгрузка всех заказов клиента с позициями и платежами.
    /// У клиента могут быть тысячи заказов, поэтому:
    ///  - AsNoTracking() - не тратим память/время на change tracking;
    ///  - AsSplitQuery() - две коллекции (Items, Payments) не перемножаются в один JOIN;
    ///  - IAsyncEnumerable - заказы отдаются по мере чтения из БД, а не загружаются
    ///    все разом в List (тысячи заказов * items * payments иначе лягут в память целиком).
    /// Порядок по CreatedAt - для стабильной/детерминированной выгрузки.
    /// Вызывающий код перебирает результат через `await foreach` и сам передаёт
    /// CancellationToken через `.WithCancellation(ct)`.
    /// </summary>
    public IAsyncEnumerable<Order> GetCustomerOrdersAsync(Guid customerId) =>
        _db.Orders
            .AsNoTracking()
            .AsSplitQuery()
            .Where(o => o.CustomerId == customerId)
            .Include(o => o.Items)
            .Include(o => o.Payments)
            .OrderBy(o => o.CreatedAt)
            .AsAsyncEnumerable();

    /// <summary>
    /// (в) Продукт по SKU и (опционально) складу.
    /// Один и тот же SKU может лежать на нескольких складах, но на конкретном складе SKU уникален.
    /// Сейчас бизнес обычно передаёт только sku (warehouse == null/пустой):
    ///  - если склад указан - возвращаем единственный продукт с этим (sku, warehouse);
    ///  - если склад не указан и совпадение одно - возвращаем его;
    ///  - если склад не указан и SKU есть сразу на нескольких складах - неоднозначность,
    ///    молча выбирать "случайный" склад нельзя (цена/остаток на складах разные),
    ///    поэтому бросаем исключение с перечислением складов, где найден SKU,
    ///    чтобы вызывающая сторона переспросила склад у пользователя/бизнеса.
    /// </summary>
    public async Task<Product?> GetProductBySku(string sku, string? warehouse, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(sku))
            throw new ArgumentException("SKU обязателен.", nameof(sku));

        if (!string.IsNullOrWhiteSpace(warehouse))
        {
            return await _db.Products
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Sku == sku && p.Warehouse == warehouse, ct);
        }

        var matches = await _db.Products
            .AsNoTracking()
            .Where(p => p.Sku == sku)
            .ToListAsync(ct);

        if (matches.Count <= 1)
            return matches.SingleOrDefault();

        var warehouses = string.Join(", ", matches.Select(p => p.Warehouse));
        throw new InvalidOperationException(
            $"SKU '{sku}' найден сразу на нескольких складах ({warehouses}). " +
            "Укажите склад явно (warehouse), чтобы выбрать конкретный продукт.");
    }

    /// <summary>
    /// (г) Дата отгрузки последнего отгруженного заказа клиента.
    /// Возврат не-nullable DateTime: если у клиента нет ни одного отгруженного заказа
    /// (ShippedAt == null у всех), это исключительная ситуация для вызывающего кода,
    /// а не «дата по умолчанию», поэтому бросаем InvalidOperationException, а не
    /// возвращаем DateTime.MinValue (это легко спутать с реальной датой).
    /// </summary>
    public async Task<DateTime> GetLastShippedDateAsync(Guid customerId, CancellationToken ct = default)
    {
        var lastShippedAt = await _db.Orders
            .AsNoTracking()
            .Where(o => o.CustomerId == customerId && o.ShippedAt != null)
            .MaxAsync(o => o.ShippedAt, ct);

        return lastShippedAt ?? throw new InvalidOperationException(
            $"У клиента {customerId} нет ни одного отгруженного заказа.");
    }
}
