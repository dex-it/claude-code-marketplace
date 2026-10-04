Готово.

**Изменённые файлы:**
- `Model.cs` — добавлено `Order.Complexity` (int 1..5) с CHECK-ограничением `CK_Order_Complexity_Range`; для `CreatedAt` добавлен `ValueConverter` (на запись снимает `Kind` → `Unspecified` без сдвига значения, на чтение проставляет `Kind=Utc`) — колонка осталась `timestamp without time zone`; в `OnModelCreating` явно настроены `Order.Items`/`Order.Payments` через `HasForeignKey(OrderId)` + `OnDelete(DeleteBehavior.Restrict)`.
- `OrderRepository.cs` — добавлен `ClearItemsAsync(Guid orderId)`: загружает Order с Items, `Items.Clear()`, `SaveChangesAsync()`.
- `_answer.md` — тот же ответ.

**Решения:** т.к. `timestamp without time zone` не хранит Kind и Npgsql 6+ не даёт писать в неё `Kind=Utc`, конвертер на запись нормализует к UTC и снимает метку, на чтение восстанавливает `Kind=Utc` — колонка не тронута, в коде всегда UTC. Для FK Items/Payments выбран `Restrict` вместо каскада по умолчанию, чтобы случайное физическое удаление Order не сносило дочерние записи в обход soft-delete.