Изменённые/созданные файлы:
- `Model.cs` — добавлено `Order.Complexity` (1..5, с check-constraint), `HasConversion` для `CreatedAt` (UTC в коде, колонка не меняется), явные `HasMany/WithOne/OnDelete` для `Order.Items` и `Order.Payments`.
- `OrderRepository.cs` — добавлен `ClearItems(Guid orderId)`.
- `_answer.md` — создан с тем же текстом.

Ключевые решения: с Npgsql 6+ `timestamp without time zone` принимает только `DateTimeKind.Unspecified`, поэтому вместо изменения типа колонки используется `ValueConverter`, снимающий Kind при записи и проставляющий `Utc` при чтении. `Items`/`Payments` сконфигурированы как обязательные связи с `Cascade` — soft-delete через `IsDeleted` их не затрагивает, а `Clear()` коллекции при реальном сохранении удаляет позиции как orphans.