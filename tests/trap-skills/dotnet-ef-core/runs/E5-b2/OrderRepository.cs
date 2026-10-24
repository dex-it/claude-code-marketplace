namespace Shop.Data;

// Бросается, когда заказ между чтением в админке и сохранением уже был
// изменён другим оператором (сравнение по Version/xmin не совпало).
public class OrderConcurrencyException : Exception
{
    public Guid OrderId { get; }

    public OrderConcurrencyException(Guid orderId, Exception inner)
        : base($"Order {orderId} was modified by another operator. Reload and retry.", inner)
        => OrderId = orderId;
}

public class OrderRepository
{
    private readonly ShopDbContext _db;
    public OrderRepository(ShopDbContext db) => _db = db;
    public Task<List<Order>> GetAllAsync() => _db.Orders.ToListAsync();
    public Task<Order?> GetAsync(Guid id) => _db.Orders.FirstOrDefaultAsync(o => o.Id == id);

    // (a) Сохранение правок заказа из админки при параллельной работе операторов.
    //
    // Ожидается, что вызывающий код сначала прочитал заказ (GetAsync), получил
    // вместе с ним текущее значение Version (=xmin на момент чтения), внёс правки
    // в форме и передаёт сюда изменённый экземпляр с тем же Id и тем же Version,
    // с которым заказ был прочитан.
    //
    // Присоединяем как Unchanged (Attach), а не Update(), и переводим в Modified
    // только сам заказ - иначе Update() рекурсивно помечает весь граф
    // (Items/Payments/Customer) как Modified/Added по эвристике наличия ключей,
    // что нам тут не нужно и не безопасно.
    //
    // order.Version при этом остаётся тем значением, с которым заказ был
    // прочитан из БД (оно передаётся вызывающей стороной вместе с формой
    // правок), и EF Core использует его как OriginalValue конкуренц-токена.
    // В итоге генерируется UPDATE ... WHERE "Id" = @id AND xmin = @version.
    // Если за это время заказ уже сохранил другой оператор, xmin в БД не
    // совпадёт, ни одна строка не обновится, и EF Core бросит
    // DbUpdateConcurrencyException - это и есть корректная обработка гонки,
    // а не молчаливая потеря чужих изменений ("lost update").
    public async Task UpdateOrderAsync(Order order, CancellationToken ct = default)
    {
        _db.Attach(order);
        _db.Entry(order).State = EntityState.Modified;
        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException ex)
        {
            throw new OrderConcurrencyException(order.Id, ex);
        }
    }
}
