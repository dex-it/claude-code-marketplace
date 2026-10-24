Готово.

**Создан файл:** `CatalogMaintenanceService.cs` (namespace `Shop.Data`), `_answer.md`.

Решения:
- (а) `ExecuteUpdateAsync` для повышения цены — один `UPDATE`, без загрузки/трекинга сущностей.
- (б) Ночная очистка `AuditLogs` — удаление батчами по 10 000 через `ExecuteDeleteAsync` с keyset-границей по `Id` (каждый батч — своя короткая транзакция, а не одна на ~40 млн строк); сравнение по `DateTime.UtcNow`, т.к. `AuditLog.At` по умолчанию маппится Npgsql в `timestamp with time zone`, что требует `Kind=Utc`.
- (в) `RestockAsync` — грузит только нужные продукты, суммирует дубликаты id, один `SaveChangesAsync` вне цикла.
- (г) `CreateProductAsync` — `Guid.NewGuid()` на клиенте, поэтому `Add`, а не `AddAsync`.