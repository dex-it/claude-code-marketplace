Изменённые файлы: `Model.cs`, `OrderRepository.cs`; создан `_answer.md`.

Кратко о решениях:
- `Complexity` добавлен в `Order`, диапазон 1..5 обеспечен check-constraint'ом в `OnModelCreating`.
- Колонку `CreatedAt` не трогал — добавил `HasConversion` (Utc↔Unspecified), чтобы в коде всегда был `Kind=Utc`, а в БД по-прежнему `timestamp without time zone` с теми же значениями для отчётов DBA.
- `Order->Items`/`Order->Payments` настроены с `DeleteBehavior.Restrict` (soft-delete на Order, каскад БД не нужен); `ClearItemsAsync` явно удаляет `OrderItem` через `RemoveRange`, а не через разрыв required-связи, иначе `SaveChanges` бросил бы `InvalidOperationException`.