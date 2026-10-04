Изменённые/созданные файлы:
- `Model.cs` — добавлено `Order.Complexity` (int, 1..5 + CHECK-constraint); для `CreatedAt` добавлен `ValueConverter`, снимающий `Kind` перед записью и проставляющий `Kind=Utc` при чтении (тип и содержимое колонки не меняются); в `OnModelCreating` явно настроены связи `Order -> Items` и `Order -> Payments` с `OnDelete(Cascade)`.
- `OrderRepository.cs` — добавлен метод `ClearItems(Guid orderId)`: загружает заказ с `Items`, `Items.Clear()`, `SaveChangesAsync()`.
- `_answer.md` — тот же отчёт.

Решения: `Cascade` для Items/Payments выбран потому, что `OrderId` — обязательный FK, а `ClearItems` разрывает связь через `Clear()`, что при `Restrict`/`ClientSetNull` бросило бы `InvalidOperationException`; для `CreatedAt` конвертер точечно приводит `Kind` к тому, что ждёт `timestamp without time zone` в Npgsql 6+, не трогая саму колонку.