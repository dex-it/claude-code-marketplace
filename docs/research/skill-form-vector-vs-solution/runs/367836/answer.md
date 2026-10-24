Изменённые/созданные файлы:
- `Model.cs` — добавлено `Order.Complexity` (int 1..5, `IsRequired()` + CHECK `CK_Order_Complexity_Range`); для `CreatedAt` добавлен `ValueConverter<DateTime, DateTime>` (в БД — `ToUniversalTime()` при необходимости, из БД — `DateTime.SpecifyKind(..., Utc)`), тип колонки `timestamp without time zone` не тронут; в `OnModelCreating` явно настроены `Order.HasMany(Items/Payments).WithOne().HasForeignKey(...).OnDelete(Cascade)`, `HasQueryFilter(!IsDeleted)` сохранён.
- `OrderRepository.cs` — добавлен `ClearItems(Guid orderId)`: `Include(Items)` → `Items.Clear()` → `SaveChangesAsync()`.
- `_answer.md` — этот же ответ.

Решения: UTC гарантируется конвертером значений, а не изменением колонки или её типа, поэтому отчёты DBA не задеты; `OnDelete(Cascade)` на required FK `OrderItem/Payment.OrderId` прописан явно, иначе `Items.Clear()` попытался бы обнулить non-nullable FK и упал бы; диапазон Complexity закреплён CHECK-constraint'ом в БД, а не только на уровне C#.