Изменённые/созданные файлы:
- `Model.cs` — свойство `Order.Complexity` (int, check-constraint 1..5); конвертер Utc↔Unspecified для `CreatedAt` поверх неизменной колонки `timestamp without time zone`; `Order -> Items`/`Order -> Payments` настроены как required FK с `DeleteBehavior.Restrict` (совместимо с soft-delete через `HasQueryFilter`).
- `OrderRepository.cs` — метод `ClearItems(Guid orderId)`.
- `_answer.md` — записан этот же ответ.

Решения: колонку `CreatedAt` не трогал — маппинг конвертирует `Utc↔Unspecified`, так что в коде всегда `Kind=Utc`, а числа в БД не меняются. Связи Items/Payments — required + `Restrict`, поэтому `ClearItems` удаляет позиции явно через `RemoveRange`, а не `Items.Clear()` (иначе `SaveChanges` бросил бы `InvalidOperationException`). `Complexity` дополнительно ограничен check-constraint'ом в БД, а не только в C#.