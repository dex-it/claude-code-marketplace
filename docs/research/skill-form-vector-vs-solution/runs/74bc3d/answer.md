Изменённые файлы:
- **Model.cs** — добавлено `Order.Complexity` (int, обязательное, CHECK 1..5); для `CreatedAt` добавлен `HasConversion`, приводящий значение к UTC на запись (`ToUniversalTime()`) и помечающий его как `DateTimeKind.Utc` на чтение — тип колонки `timestamp without time zone` не тронут; в `OnModelCreating` явно настроены связи `Order→Items` и `Order→Payments` через `HasForeignKey(OrderId)` с каскадным удалением.
- **OrderRepository.cs** — добавлен `ClearItemsAsync(Guid orderId)`: загружает заказ с `Include(Items)`, очищает коллекцию, сохраняет — EF удаляет осиротевшие `OrderItem` благодаря обязательному FK.

Решения: CHECK-констрейнт на Complexity защищает и от прямых SQL-вставок; конвертер даты работает для всех путей чтения/записи через контекст без изменения схемы; ClearItems реализован через навигацию, чтобы не заводить лишний `DbSet<OrderItem>`.

Тот же текст записан в `work/_answer.md`.