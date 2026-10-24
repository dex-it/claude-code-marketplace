Изменённые/созданные файлы:
- `Model.cs` — добавлено `Order.Complexity` (int, 1..5, с CHECK-constraint); `CreatedAt` замаплен через `ValueConverter<DateTime,DateTime>` (колонка `timestamp without time zone` не менялась); явно настроены связи Order → Items и Order → Payments (обязательные, `DeleteBehavior.Cascade`).
- `OrderRepository.cs` — добавлен `ClearItemsAsync(Guid orderId)`.
- `_answer.md` — этот же ответ.

Решения: Npgsql 8 не принимает `DateTime` с `Kind=Utc` для `timestamp without time zone`, поэтому конвертер снимает Kind при записи и восстанавливает `Utc` при чтении — хранимые значения не трогаются, в коде всегда UTC. Связь Order→Items/Payments сделана обязательной с `Cascade`, иначе `Items.Clear()` в `ClearItemsAsync` падал бы с ошибкой "required relationship severed" вместо удаления строк. Диапазон Complexity закреплён CHECK-constraint'ом на уровне БД, а не только валидацией в коде.