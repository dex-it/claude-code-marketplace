Готово. Изменённые/созданные файлы:

- **Model.cs** — добавлено `Order.Complexity` (int) с check-constraint `1..5`; для `CreatedAt` подключён `ValueConverter`, который на чтении проставляет `DateTimeKind.Utc`, а на записи нормализует в UTC (тип колонки `timestamp without time zone` не менялся); в `OnModelCreating` явно настроены `Order → Items` (`Cascade`) и `Order → Payments` (`Restrict`).
- **OrderRepository.cs** — добавлен `ClearItemsAsync(Guid orderId)`.
- **_answer.md** — записан этот же ответ.

Кратко о решениях:
- `CreatedAt`: колонку трогать нельзя, поэтому вместо смены типа применён конвертер — Npgsql возвращает `timestamp without time zone` с `Kind=Unspecified`, конвертер явно приводит его к `Utc` при чтении и нормализует любое значение в UTC при записи.
- `Items` настроен на `Cascade`, иначе `Clear()` коллекции при required FK (`OrderId` не nullable) упал бы с `InvalidOperationException` в `SaveChanges` (правило про разрыв required-связи), и `ClearItemsAsync` не работал бы. `Payments` — `Restrict`, чтобы случайный хард-`Remove()` заказа в обход soft-delete не удалил платежи каскадом.