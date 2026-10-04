Созданные файлы:
- `CatalogMaintenance.cs` — сервис с методами `RaisePricesAsync`, `PurgeOldAuditLogsAsync`, `RestockAsync`, `CreateProductAsync`.
- `AuditLogCleanupHostedService.cs` — фоновый планировщик ночной очистки.

Решения:
- Цены поднимаются через `ExecuteUpdateAsync` (один UPDATE на сервере, без загрузки сущностей и трекинга) вместо чтения всех полей и `SaveChanges` в цикле.
- Очистка AuditLogs идёт пачками (`DELETE ... WHERE Id IN (SELECT ... LIMIT batchSize)` в цикле), каждая пачка — своя короткая транзакция, а не одна гигантская на ~40 млн строк; запускается через `BackgroundService` + `IServiceScopeFactory`, чтобы не держать scoped `DbContext` в singleton.
- Restock грузит продукты одним запросом с трекингом (это запись), меняет Stock в памяти и делает один `SaveChangesAsync`.
- CreateProduct использует синхронный `Add`, т.к. Id — клиентский Guid, а не значение из БД.