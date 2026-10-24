## Изменённые файлы
- `Model.cs` — добавлено поле `Order.Complexity`, конвертер UTC для `CreatedAt`, конфигурация связей `Order -> Items` / `Order -> Payments`.
- `OrderRepository.cs` — добавлен метод `ClearItems(Guid orderId)`.
- `_answer.md` — этот же ответ.

## Решения
- `Complexity` (int, 1..5) — простое поле + `CHECK (Complexity BETWEEN 1 AND 5)`, чтобы диапазон был гарантирован на уровне БД.
- Тип колонки `CreatedAt` не менялся. Добавлен `ValueConverter`: при записи Kind приводится к `Unspecified` (так требует Npgsql 8 для `timestamp without time zone`), при чтении обратно проставляется `Utc` — код всегда видит UTC, DBA-отчёты не затронуты.
- `Order -> Items`/`Payments` сконфигурированы как обязательные связи с `Cascade`, поэтому `Items.Clear()` + `SaveChanges` удаляет осиротевшие строки, а не пытается обнулить non-null `OrderId`; на этом же механизме построен `ClearItems`.