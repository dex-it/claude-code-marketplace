## Созданные/изменённые файлы

- `CatalogMaintenance.cs` (новый) — сервис `Shop.Data.CatalogMaintenance`.

## Решения

- (а) `RaisePricesAsync` делает bulk `ExecuteUpdateAsync` по всей категории одним UPDATE, без загрузки продуктов в память.
- (б) `CleanupOldAuditLogsAsync` удаляет старые записи пачками (`DELETE ... WHERE Id IN (SELECT ... ORDER BY Id LIMIT batchSize)`) с паузой между пачками — при ~40 млн строк на удаление из 50 млн один большой DELETE держал бы долгую блокировку и раздувал WAL; батчи коммитятся независимо и безопасно возобновляются при перезапуске. Предполагается индекс на `AuditLogs.At`.
- (в)/(г) `RestockAsync` грузит продукты одним запросом по списку id и увеличивает `Stock`; `CreateProductAsync` создаёт `Product` с `Guid.NewGuid()`.

Тот же текст сохранён в `_answer.md`.