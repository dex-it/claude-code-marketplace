Создан файл: `CatalogMaintenance.cs` (классы `CatalogMaintenanceService` + `AuditLogCleanupHostedService`). Ответ также записан в `_answer.md`.

Решения:
- Повышение цены — `ExecuteUpdateAsync` (bulk update на сервере, без трекинга сущностей).
- Очистка `AuditLogs` — удаление батчами по 5000 строк отдельными `ExecuteDeleteAsync` (каждый — своя короткая транзакция вместо одной на ~40 млн строк), с паузой между батчами; запуск ночью через `BackgroundService`, который создаёт новый scope/`DbContext` на каждый прогон, а не держит его постоянно. Для приемлемой скорости выборки батча желателен индекс на `AuditLogs.At` — миграцию не создавал, это вне рамок задачи.
- `Restock` — одна выборка всех нужных продуктов, обновление `Stock` в памяти, один `SaveChangesAsync` на весь набор (без `SaveChanges` в цикле).
- `CreateProduct` — Guid генерируется на клиенте, поэтому используется `Add`, а не `AddAsync`.