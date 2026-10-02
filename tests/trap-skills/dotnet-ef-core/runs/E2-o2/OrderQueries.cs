namespace Shop.Data;

public record OrderItemDto(int Id, Guid ProductId, int Qty);

public record PaymentDto(int Id, decimal Amount);

public record OrderCardDto(
    Guid Id,
    Guid CustomerId,
    string Status,
    string Category,
    decimal Total,
    DateTime CreatedAt,
    DateTime? ShippedAt,
    List<OrderItemDto> Items,
    List<PaymentDto> Payments);

public record CustomerOrderDto(
    Guid Id,
    string Status,
    string Category,
    decimal Total,
    DateTime CreatedAt,
    DateTime? ShippedAt,
    List<OrderItemDto> Items,
    List<PaymentDto> Payments);

/// <summary>
/// Read-only запросы по заказам/продуктам. Все методы — AsNoTracking (данные не изменяются вызывающим кодом).
/// </summary>
public class OrderQueries
{
    private readonly ShopDbContext _db;
    public OrderQueries(ShopDbContext db) => _db = db;

    /// <summary>
    /// (а) Карточка одного заказа со всеми позициями и платежами.
    /// Проекция в DTO (не Include): EF строит корреллированные подзапросы для Items/Payments,
    /// а не JOIN — cartesian explosion между Items и Payments не возникает и AsSplitQuery не нужен
    /// (для одной записи он был бы лишним round-trip'ом).
    /// </summary>
    public Task<OrderCardDto?> GetOrderCardAsync(Guid orderId) =>
        _db.Orders
            .AsNoTracking()
            .Where(o => o.Id == orderId)
            .Select(o => new OrderCardDto(
                o.Id,
                o.CustomerId,
                o.Status,
                o.Category,
                o.Total,
                o.CreatedAt,
                o.ShippedAt,
                o.Items.Select(i => new OrderItemDto(i.Id, i.ProductId, i.Qty)).ToList(),
                o.Payments.Select(p => new PaymentDto(p.Id, p.Amount)).ToList()))
            .SingleOrDefaultAsync();

    /// <summary>
    /// (б) Все заказы клиента с позициями и платежами. У клиента бывают тысячи заказов, поэтому:
    /// - проекция в DTO вместо Include (те же корреллированные подзапросы, не JOIN — без cartesian explosion
    ///   и без раздувания Change Tracker'ом на тысячах сущностей);
    /// - AsNoTracking (read-only выгрузка);
    /// - IAsyncEnumerable вместо List — вызывающий код стримит заказы по одному, не держит все
    ///   тысячи заказов с их items/payments в памяти процесса одновременно.
    /// </summary>
    public IAsyncEnumerable<CustomerOrderDto> GetCustomerOrdersAsync(Guid customerId) =>
        _db.Orders
            .AsNoTracking()
            .Where(o => o.CustomerId == customerId)
            .OrderBy(o => o.CreatedAt)
            .Select(o => new CustomerOrderDto(
                o.Id,
                o.Status,
                o.Category,
                o.Total,
                o.CreatedAt,
                o.ShippedAt,
                o.Items.Select(i => new OrderItemDto(i.Id, i.ProductId, i.Qty)).ToList(),
                o.Payments.Select(p => new PaymentDto(p.Id, p.Amount)).ToList()))
            .AsAsyncEnumerable();

    /// <summary>
    /// (в) Продукт по SKU на складе. Один SKU может лежать на нескольких складах, но на одном
    /// складе SKU уникален. Сейчас бизнес иногда передаёт только sku (warehouse — null/пусто):
    /// - если warehouse задан — фильтруем по sku+warehouse, это уникальная комбинация;
    /// - если warehouse не задан, а у sku несколько складов — результат неоднозначен. Вместо
    ///   молчаливого Single(), который упал бы с малоинформативным исключением (см. skill:
    ///   "Single() на запросе без уникального ограничения"), явно проверяем это через Take(2)
    ///   (не тянем со всех складов сразу все строки — не нужно, если складов много) и бросаем
    ///   понятную ошибку с просьбой уточнить склад, вместо того чтобы тихо вернуть случайный склад.
    /// </summary>
    public async Task<Product?> GetProductBySku(string sku, string? warehouse)
    {
        var query = _db.Products.AsNoTracking().Where(p => p.Sku == sku);
        if (!string.IsNullOrEmpty(warehouse))
            query = query.Where(p => p.Warehouse == warehouse);

        var matches = await query.Take(2).ToListAsync();
        return matches.Count switch
        {
            0 => null,
            1 => matches[0],
            _ => throw new InvalidOperationException(
                $"SKU '{sku}' найден на нескольких складах — необходимо уточнить warehouse.")
        };
    }

    /// <summary>
    /// (г) Дата отгрузки последнего отгруженного заказа клиента. Агрегация MaxAsync выполняется
    /// в СУБД (см. skill: "GroupBy/агрегации в памяти" — агрегации должны идти SQL-запросом),
    /// без загрузки заказов в память. Возврат — не-nullable DateTime по контракту метода: если
    /// у клиента нет ни одного отгруженного заказа, это ошибка вызывающей стороны (проверить
    /// наличие отгрузок до вызова), а не null/DateTime.MinValue, которые тихо сойдут за дату.
    /// </summary>
    public async Task<DateTime> GetLastShippedAtAsync(Guid customerId)
    {
        var lastShippedAt = await _db.Orders
            .Where(o => o.CustomerId == customerId && o.ShippedAt != null)
            .MaxAsync(o => (DateTime?)o.ShippedAt);

        return lastShippedAt ??
            throw new InvalidOperationException($"У клиента {customerId} нет отгруженных заказов.");
    }
}
