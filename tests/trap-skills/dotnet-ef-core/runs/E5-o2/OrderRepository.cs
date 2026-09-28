using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

/// <summary>
/// Заказ был изменён другим оператором между чтением и сохранением текущей правки
/// (xmin, прочитанный при открытии формы, не совпал с текущим значением в БД).
/// Обработчик в админке должен перечитать заказ, показать актуальную версию и
/// предложить оператору повторить правку.
/// </summary>
public class OrderConcurrencyConflictException : Exception
{
    public Guid OrderId { get; }
    public OrderConcurrencyConflictException(Guid orderId, Exception inner)
        : base($"Order {orderId} was modified by another operator concurrently.", inner)
        => OrderId = orderId;
}

public class OrderRepository
{
    private readonly ShopDbContext _db;
    public OrderRepository(ShopDbContext db) => _db = db;
    public Task<List<Order>> GetAllAsync() => _db.Orders.ToListAsync();
    public Task<Order?> GetAsync(Guid id) => _db.Orders.FirstOrDefaultAsync(o => o.Id == id);

    /// <summary>
    /// Возвращает текущее значение xmin (concurrency token) заказа - его нужно
    /// передать операторской форме вместе с данными заказа и потом вернуть
    /// в <see cref="UpdateOrderAsync"/> как <c>expectedVersion</c>.
    /// </summary>
    public uint GetVersion(Order order) => (uint)_db.Entry(order).Property("xmin").CurrentValue!;

    /// <summary>
    /// Сохраняет правки заказа, сделанные оператором в админке, безопасно при
    /// параллельной правке того же заказа другим оператором: <paramref name="order"/> -
    /// как правило detached-сущность (пришла из формы редактирования), а
    /// <paramref name="expectedVersion"/> - xmin, который оператор видел при открытии формы.
    /// Если запись в БД успела измениться (xmin разошёлся), Postgres/EF не находит строку
    /// по WHERE-условию с ожидаемым xmin, SaveChangesAsync бросает
    /// DbUpdateConcurrencyException, и мы переводим её в понятное доменное исключение,
    /// вместо тихой перезаписи чужих изменений ("last write wins").
    /// </summary>
    public async Task UpdateOrderAsync(Order order, uint expectedVersion)
    {
        _db.Attach(order);
        var entry = _db.Entry(order);
        entry.Property("xmin").OriginalValue = expectedVersion;
        entry.State = EntityState.Modified;

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException ex)
        {
            throw new OrderConcurrencyConflictException(order.Id, ex);
        }
    }
}
