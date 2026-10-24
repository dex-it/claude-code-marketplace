using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

/// <summary>
/// Бросается, когда UpdateOrderAsync обнаруживает, что заказ был изменён
/// другим оператором между чтением (GetForEditAsync) и сохранением.
/// </summary>
public class OrderConcurrencyConflictException : Exception
{
    public Guid OrderId { get; }

    public OrderConcurrencyConflictException(Guid orderId, Exception inner)
        : base($"Заказ {orderId} уже был изменён другим оператором. Обновите страницу и повторите правку.", inner)
        => OrderId = orderId;
}

public class OrderRepository
{
    private readonly ShopDbContext _db;
    public OrderRepository(ShopDbContext db) => _db = db;

    // Списки/просмотр - без трекинга, изменения через них не сохраняются.
    public Task<List<Order>> GetAllAsync() => _db.Orders.AsNoTracking().ToListAsync();
    public Task<Order?> GetAsync(Guid id) => _db.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == id);

    /// <summary>
    /// Загрузка заказа для редактирования оператором в админке. Возвращает
    /// сам заказ и текущее значение конкурентного токена (xmin), которое
    /// клиент должен вернуть обратно при сохранении (UpdateOrderAsync).
    /// Сущность возвращается tracked, т.к. дальше по ней будет UPDATE.
    /// </summary>
    public async Task<(Order Order, uint RowVersion)?> GetForEditAsync(Guid id)
    {
        var order = await _db.Orders
            .Include(o => o.Items)
            .Include(o => o.Payments)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (order is null) return null;

        var rowVersion = (uint)_db.Entry(order).Property("xmin").CurrentValue!;
        return (order, rowVersion);
    }

    /// <summary>
    /// Сохранение изменений заказа из формы админки. Каждый HTTP-запрос
    /// (и, соответственно, каждый вызов этого метода) работает со своим
    /// экземпляром ShopDbContext, поэтому заказ приходит "отсоединённым" -
    /// его нужно заново присоединить (Attach) и явно указать оригинальное
    /// значение xmin, полученное при загрузке (GetForEditAsync). Если за
    /// это время другой оператор уже сохранил свои правки, xmin в БД не
    /// совпадёт с тем, что мы прислали в WHERE, ни одна строка не обновится,
    /// и EF Core сгенерирует DbUpdateConcurrencyException - на этом месте
    /// мы превращаем её в понятное доменное исключение.
    /// </summary>
    public async Task UpdateOrderAsync(Order updated, uint rowVersion)
    {
        var entry = _db.Attach(updated);
        entry.Property("xmin").OriginalValue = rowVersion;
        entry.State = EntityState.Modified;

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException ex)
        {
            throw new OrderConcurrencyConflictException(updated.Id, ex);
        }
    }
}
