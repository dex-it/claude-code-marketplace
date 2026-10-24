using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

/// <summary>
/// Read-only запросы для карточки заказа, выгрузки заказов клиента,
/// поиска товара по SKU и даты последней отгрузки.
/// </summary>
public class OrderQueries
{
    private readonly ShopDbContext _db;
    public OrderQueries(ShopDbContext db) => _db = db;

    /// <summary>
    /// (a) Карточка одного заказа со всеми позициями и платежами.
    /// Для single entity JOIN эффективнее двух round-trip'ов — AsSplitQuery не используем.
    /// </summary>
    public Task<Order?> GetOrderCardAsync(Guid orderId) =>
        _db.Orders
            .AsNoTracking()
            .Include(o => o.Items)
            .Include(o => o.Payments)
            .FirstOrDefaultAsync(o => o.Id == orderId);

    /// <summary>
    /// (b) Все заказы клиента с позициями и платежами. У клиента бывают тысячи заказов,
    /// а два Include (Items + Payments) дают cartesian product — используем AsSplitQuery,
    /// чтобы не раздувать трафик и не плодить дубликаты строк.
    /// </summary>
    public Task<List<Order>> GetCustomerOrdersAsync(Guid customerId) =>
        _db.Orders
            .AsNoTracking()
            .Where(o => o.CustomerId == customerId)
            .Include(o => o.Items)
            .Include(o => o.Payments)
            .AsSplitQuery()
            .OrderBy(o => o.CreatedAt)
            .ToListAsync();

    /// <summary>
    /// (c) Продукт по SKU на складе. SKU уникален только в паре (Sku, Warehouse) —
    /// сам по себе SKU повторяется на разных складах. Бизнес сейчас передаёт warehouse
    /// как null, поэтому Single()/SingleOrDefault() по одному Sku — бомба замедленного
    /// действия: сработает до второго склада с тем же SKU, а затем начнёт падать
    /// InvalidOperationException. Правило из чек-листа: если warehouse задан — уточняем
    /// до уникального условия (Sku, Warehouse) и берём его через SingleOrDefault; если нет —
    /// не гадаем, а детерминированно берём первый допустимый результат (сортировка по
    /// Warehouse делает выбор воспроизводимым, а не "какой предложит план запроса").
    /// </summary>
    public Task<Product?> GetProductBySku(string sku, string? warehouse = null)
    {
        var query = _db.Products.AsNoTracking().Where(p => p.Sku == sku);

        return warehouse != null
            ? query.Where(p => p.Warehouse == warehouse).SingleOrDefaultAsync()
            : query.OrderBy(p => p.Warehouse).FirstOrDefaultAsync();
    }

    /// <summary>
    /// (г) Дата отгрузки последнего отгруженного заказа клиента. ShippedAt — nullable
    /// колонка, но метод возвращает non-nullable DateTime: агрегируем MAX на сервере
    /// (а не Max() после ToList в памяти), а на отсутствие отгруженных заказов у клиента
    /// отвечаем явным исключением, а не null-forgiving оператором (WHERE уже исключил
    /// null, так что ! был бы формально безопасен, но не сообщает о пустом результате).
    /// </summary>
    public async Task<DateTime> GetLastShipmentDateAsync(Guid customerId)
    {
        var lastShippedAt = await _db.Orders
            .AsNoTracking()
            .Where(o => o.CustomerId == customerId && o.ShippedAt != null)
            .Select(o => o.ShippedAt)
            .MaxAsync();

        return lastShippedAt
            ?? throw new InvalidOperationException($"У клиента {customerId} нет отгруженных заказов.");
    }
}
