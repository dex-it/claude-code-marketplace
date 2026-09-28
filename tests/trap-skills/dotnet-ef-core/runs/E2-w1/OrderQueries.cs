using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

/// <summary>
/// Read-only выборки для заказов и товаров. Все методы работают без трекинга
/// (AsNoTracking) — сущности используются только для чтения/отображения, а не
/// для последующего SaveChangesAsync.
/// </summary>
public class OrderQueries
{
    private readonly ShopDbContext _db;
    public OrderQueries(ShopDbContext db) => _db = db;

    /// <summary>
    /// (а) Карточка одного заказа: сам заказ + все позиции (Items) и все платежи (Payments).
    /// Действует глобальный HasQueryFilter(!IsDeleted) на Order — мягко удалённый заказ
    /// карточкой не вернётся, отдельного метода "включая удалённые" не заводим,
    /// так как в поручении это не требуется.
    /// </summary>
    public Task<Order?> GetOrderCardAsync(Guid orderId) =>
        _db.Orders
            .AsNoTracking()
            .Include(o => o.Items)
            .Include(o => o.Payments)
            .FirstOrDefaultAsync(o => o.Id == orderId);

    /// <summary>
    /// (б) Выгрузка всех заказов клиента с позициями и платежами.
    ///
    /// У Order сразу две коллекции-навигации (Items и Payments). Если сделать
    /// два .Include() в одном SQL-запросе, EF строит их через JOIN, и при
    /// нескольких позициях и нескольких платежах на заказ строки перемножаются
    /// (декартово произведение): условно 5 позиций × 3 платежа = 15 строк на один
    /// заказ. У клиента "бывают тысячи заказов" — без AsSplitQuery это быстро
    /// превращается в запрос на сотни тысяч строк и лишний трафик. Поэтому здесь
    /// обязателен .AsSplitQuery() — Items и Payments будут забираться отдельными
    /// SQL-запросами и склеиваться на стороне EF.
    ///
    /// Отдаём IAsyncEnumerable, а не List: это "выгрузка", вызывающий код может
    /// стримить/писать заказы по мере получения, не держа в памяти сразу все
    /// тысячи Order с вложенными коллекциями.
    /// </summary>
    public IAsyncEnumerable<Order> GetCustomerOrdersAsync(Guid customerId) =>
        _db.Orders
            .AsNoTracking()
            .Where(o => o.CustomerId == customerId)
            .Include(o => o.Items)
            .Include(o => o.Payments)
            .AsSplitQuery()
            .OrderByDescending(o => o.CreatedAt)
            .AsAsyncEnumerable();

    /// <summary>
    /// (в) Продукт по SKU на складе. На одном складе SKU уникален, но сейчас бизнес
    /// иногда передаёт только sku (warehouse == null/пустая строка) — а один и тот же
    /// SKU может лежать на нескольких разных складах.
    ///
    /// Условие строится через IQueryable (Where добавляется условно до выполнения
    /// запроса), а не через C#-метод внутри предиката — вся фильтрация остаётся
    /// переводимой в SQL.
    ///
    /// - warehouse указан: фильтруем по (Sku, Warehouse) и берём SingleOrDefault —
    ///   по инварианту "на складе SKU уникален" строка должна быть максимум одна;
    ///   если их вдруг больше — это нарушение данных, и лучше упасть, чем тихо
    ///   вернуть случайную.
    /// - warehouse не указан: ищем все продукты с этим SKU. Если он лежит только
    ///   на одном складе — возвращаем его. Если на нескольких — это неоднозначный
    ///   запрос (мы не знаем, какой склад имел в виду вызывающий), кидаем понятное
    ///   исключение вместо того, чтобы наугад отдать не тот остаток/цену.
    /// </summary>
    public async Task<Product?> GetProductBySkuAsync(string sku, string? warehouse)
    {
        IQueryable<Product> query = _db.Products
            .AsNoTracking()
            .Where(p => p.Sku == sku);

        if (!string.IsNullOrEmpty(warehouse))
        {
            return await query
                .Where(p => p.Warehouse == warehouse)
                .SingleOrDefaultAsync();
        }

        var candidates = await query.ToListAsync();
        if (candidates.Count > 1)
        {
            throw new InvalidOperationException(
                $"SKU '{sku}' найден на {candidates.Count} разных складах " +
                "(" + string.Join(", ", candidates.Select(p => p.Warehouse)) + ") " +
                "— нужно передать склад явно.");
        }

        return candidates.SingleOrDefault();
    }

    /// <summary>
    /// (г) Дата отгрузки последнего отгруженного заказа клиента.
    ///
    /// Order.ShippedAt (DateTime?) не имеет явного HasColumnType в OnModelCreating,
    /// поэтому в отличие от CreatedAt (явно "timestamp without time zone") маппится
    /// по конвенции Npgsql 6+ на timestamptz — Npgsql отдаёт такое значение с
    /// DateTime.Kind == Utc. Возвращаемое отсюда значение нужно трактовать как UTC.
    ///
    /// MAX по SQL сам игнорирует NULL, поэтому достаточно агрегата без доп. фильтра
    /// по ShippedAt != null — предикат по CustomerId уже сузит выборку по индексу.
    ///
    /// Контракт метода — DateTime, не nullable: если у клиента ни один заказ ещё не
    /// отгружен, "даты отгрузки" не существует в принципе, поэтому вместо того чтобы
    /// подставлять фиктивную дату (например, DateTime.MinValue), бросаем понятное
    /// исключение — тихая заглушка тут была бы более опасной ошибкой.
    /// </summary>
    public async Task<DateTime> GetLastShippedAtAsync(Guid customerId)
    {
        var lastShippedAt = await _db.Orders
            .AsNoTracking()
            .Where(o => o.CustomerId == customerId)
            .MaxAsync(o => (DateTime?)o.ShippedAt);

        return lastShippedAt ?? throw new InvalidOperationException(
            $"У клиента {customerId} нет ни одного отгруженного заказа.");
    }
}
