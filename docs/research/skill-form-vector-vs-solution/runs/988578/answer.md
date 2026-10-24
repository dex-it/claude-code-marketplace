Изменённые файлы:
- `Model.cs`
- `OrderRepository.cs`
- `_answer.md` (создан, с этим же резюме)

Кратко о решениях:
- `Complexity` добавлен как int-свойство Order с диапазоном 1..5, закреплённым через `CHECK`-constraint в `OnModelCreating`, а не только валидацией в коде.
- `CreatedAt` оставлен как `timestamp without time zone`; через `ValueConverter` в БД пишется `Unspecified`, а при чтении проставляется `Kind=Utc` — колонку и отчёты DBA не трогаем, но в коде всегда UTC.
- Для `Order->Items`/`Order->Payments` задан `OnDelete(DeleteBehavior.Restrict)` (FK без каскада в БД, совместимо с soft-delete), поэтому `ClearItemsAsync` удаляет `OrderItem` напрямую по `OrderId` через `RemoveRange`, а не через `Items.Clear()`, чтобы не словить `InvalidOperationException` на разрыве required-связи.