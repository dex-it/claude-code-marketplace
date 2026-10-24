Создан файл: `CatalogMaintenance.cs` (тот же текст сохранён в `_answer.md`).

Решения:
- (а)/(б) реализованы через `ExecuteUpdateAsync`/`ExecuteDeleteAsync` вместо цикла `SaveChanges`; очистка AuditLogs — батчами по 5000 (`OrderBy(Id).Take(...).ExecuteDeleteAsync`) с `Task.Delay` между батчами, чтобы не держать одну транзакцию на ~40 млн строк удаления.
- (в) Restock грузит нужные продукты одним запросом (`Where(id => ids.Contains)`), меняет Stock и делает один `SaveChangesAsync` — без `UpdateRange`, т.к. сущности уже tracked.
- (г) CreateProduct генерирует Guid на клиенте и использует `Add()` вместо `AddAsync()`.