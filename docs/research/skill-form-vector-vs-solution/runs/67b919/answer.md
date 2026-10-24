Созданы файлы:
- `CatalogMaintenance.cs` — сервис с методами `RaisePricesAsync`, `CleanupOldAuditLogsAsync`, `RestockAsync`, `CreateProductAsync`
- `AuditLogCleanupBackgroundService.cs` — ночной триггер очистки
- `_answer.md` — тот же ответ

Решения: поднятие цен через `ExecuteUpdateAsync` (один SQL UPDATE, без загрузки в Change Tracker); очистка AuditLogs — батчами по `ExecuteDeleteAsync` с задержкой между итерациями (40 млн строк одной транзакцией недопустимо), запускается из `BackgroundService` через `IServiceScopeFactory`; `Restock` — одна загрузка продуктов по id + один `SaveChangesAsync` (приросты разные, поэтому не bulk `ExecuteUpdate`); `CreateProduct` — `Guid.NewGuid()` + `Add()` без `AddAsync`.