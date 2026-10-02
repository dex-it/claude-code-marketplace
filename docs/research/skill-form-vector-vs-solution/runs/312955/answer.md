Изменённые/созданные файлы:
- `Model.cs`
- `OrderRepository.cs`
- `_answer.md`

Решения:
- **Complexity**: `int` (1..5) на Order + `CK_Order_Complexity` CHECK-констрейнт в БД, а не только проверка в коде.
- **CreatedAt**: колонка осталась `timestamp without time zone`, но добавлен `ValueConverter` — при записи UTC-значение приводится к Kind=Unspecified (Npgsql 8 иначе не пишет Kind=Utc в этот тип), при чтении Kind выставляется в Utc. В коде CreatedAt всегда UTC, схема не тронута.
- **Order→Items/Payments**: явно заданы как required-связи с `DeleteBehavior.Restrict`, поскольку заказы удаляются только мягко (IsDeleted + query filter) — случайный физический `Remove(order)` не должен молча каскадно сносить детей.
- **ClearItemsAsync**: удаляет позиции через `RemoveRange`, а не `Items.Clear()`, так как FK OrderId у OrderItem обязателен — очистка навигации попыталась бы обнулить required FK у трекаемых сущностей.