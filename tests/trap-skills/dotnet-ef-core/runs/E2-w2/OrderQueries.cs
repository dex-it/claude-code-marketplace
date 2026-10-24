using System.Threading;
using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

/// <summary>
/// Read-only запросы по заказам и товарам.
/// Все выборки помечены AsNoTracking (данные только читаются, EF их не отслеживает).
/// Soft-delete заказов (IsDeleted) фильтруется глобально в ShopDbContext.OnModelCreating
/// (HasQueryFilter) - здесь этот фильтр применяется автоматически, отдельно его не дублируем.
/// </summary>
public class OrderQueries
{
    private readonly ShopDbContext _db;

    public OrderQueries(ShopDbContext db) => _db = db;

    /// <summary>
    /// (а) Карточка одного заказа: сам заказ со всеми позициями (Items) и платежами (Payments).
    /// AsSplitQuery - Items и Payments это две независимые коллекции заказа; один общий JOIN
    /// размножил бы строки в декартово произведение (items x payments) уже на одном заказе.
    /// </summary>
    public Task<Order?> GetOrderCardAsync(Guid orderId, CancellationToken ct = default) =>
        _db.Orders
            .Include(o => o.Items)
            .Include(o => o.Payments)
            .AsSplitQuery()
            .AsNoTracking()
            .FirstOrDefaultAsync(o => o.Id == orderId, ct);

    /// <summary>
    /// (б) Выгрузка всех заказов клиента со всеми позициями и платежами.
    /// У клиента бывают тысячи заказов, поэтому:
    ///  - результат отдаётся потоково через IAsyncEnumerable, без буферизации всего списка в памяти
    ///    (в отличие от ToListAsync, который держал бы тысячи заказов со всеми Items/Payments разом);
    ///  - AsNoTracking - без трекинга, иначе ChangeTracker раздулся бы на тысячах сущностей;
    ///  - AsSplitQuery обязателен: Items и Payments - независимые коллекции, один JOIN-запрос
    ///    размножил бы строки в декартово произведение уже на уровне одного заказа, а на тысячах
    ///    заказов это даёт огромный лишний трафик;
    ///  - при разбиении на несколько SQL-запросов (split query) EF требует детерминированный
    ///    порядок сортировки корневой выборки, иначе строки из разных под-запросов могут не
    ///    соотнестись друг с другом - поэтому OrderBy обязателен, а не "для красоты".
    /// </summary>
    public IAsyncEnumerable<Order> GetCustomerOrdersAsync(Guid customerId, CancellationToken ct = default) =>
        _db.Orders
            .Where(o => o.CustomerId == customerId)
            .Include(o => o.Items)
            .Include(o => o.Payments)
            .AsSplitQuery()
            .AsNoTracking()
            .OrderBy(o => o.CreatedAt).ThenBy(o => o.Id)
            .AsAsyncEnumerable();

    /// <summary>
    /// (в) Продукт по SKU на складе.
    /// Один и тот же SKU лежит на разных складах, в пределах одного склада SKU уникален.
    /// Сейчас бизнес передаёт только sku, warehouse может быть null (поэтому параметр string?,
    /// а не string, как было в исходной формулировке метода) - в этом случае ищем по всем складам.
    /// Условие "warehouse == null || p.Warehouse == warehouse" - это стандартный переводимый в SQL
    /// паттерн опционального фильтра (OR с параметром), а не вычисление на стороне клиента.
    /// SingleOrDefaultAsync выбран намеренно вместо FirstOrDefaultAsync: если sku без warehouse
    /// даёт больше одного совпадения (лежит сразу на нескольких складах), это неоднозначный запрос,
    /// и его нельзя молча "угадывать" - метод бросит исключение, явно требуя от вызывающей стороны
    /// уточнить склад, вместо того чтобы тихо вернуть товар не с того склада.
    /// </summary>
    public Task<Product?> GetProductBySku(string sku, string? warehouse, CancellationToken ct = default) =>
        _db.Products
            .AsNoTracking()
            .Where(p => p.Sku == sku && (warehouse == null || p.Warehouse == warehouse))
            .SingleOrDefaultAsync(ct);

    /// <summary>
    /// (г) Дата отгрузки последнего отгруженного заказа клиента.
    /// Учитываются только заказы с проставленным ShippedAt (реально отгруженные); MAX считается
    /// в базе, без выгрузки заказов клиента в память. Возврат - не nullable DateTime по контракту:
    /// если у клиента нет ни одного отгруженного заказа, MaxAsync по пустой последовательности
    /// бросит InvalidOperationException ("Sequence contains no elements") - это осознанное поведение,
    /// а не забытый null-кейс, ровно так же ведёт себя обычный Enumerable.Max() для value-типа.
    /// </summary>
    public Task<DateTime> GetLastShippedAtAsync(Guid customerId, CancellationToken ct = default) =>
        _db.Orders
            .Where(o => o.CustomerId == customerId && o.ShippedAt != null)
            .Select(o => o.ShippedAt!.Value)
            .MaxAsync(ct);
}
