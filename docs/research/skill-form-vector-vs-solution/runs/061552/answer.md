Изменённые/созданные файлы:
- `Model.cs` — добавлено `Order.Complexity` (int, CHECK 1..5), конфигурация `CreatedAt` через `HasConversion` (тип колонки не менялся), явные связи `Order -> Items`/`Order -> Payments` через `HasMany().WithOne().HasForeignKey(...)`.
- `OrderRepository.cs` — добавлен метод `ClearItemsAsync(Guid orderId)`.
- `_answer.md` — записан этот же ответ.

Решения:
- CreatedAt: колонка осталась `timestamp without time zone`, UTC-инвариант обеспечен value-конвертером EF (запись → UTC, чтение → `Kind=Utc`), а не сменой типа колонки.
- Complexity: диапазон 1..5 закреплён CHECK-констрейнтом в БД, т.к. у EF Core нет декларативной аннотации диапазона, влияющей на схему.
- Items/Payments — обязательные зависимые коллекции (FK не nullable), поэтому `Items.Clear()` физически удаляет позиции, а сам Order остаётся и удаляется мягко через существующий `HasQueryFilter`.