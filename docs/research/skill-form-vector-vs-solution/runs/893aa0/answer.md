## Созданные/изменённые файлы

- `CatalogMaintenance.cs` (новый) — сервис `CatalogMaintenance` с методами `RaisePricesAsync`, `PurgeOldAuditLogsAsync`, `RestockAsync`, `CreateProductAsync`.

## Решения

- Повышение цен — один `ExecuteUpdateAsync` (`Price = Price * 1.1`) без загрузки сущностей и трекинга; очистка `AuditLogs` — батчами по id (`ExecuteDeleteAsync` не поддерживает `Take`/`OrderBy` на удаляемом наборе), каждый батч — своя неявная короткая транзакция, а не одна на 40 млн строк, чтобы не блокировать autovacuum и не раздувать WAL; `cutoff` через `DateTime.UtcNow`, т.к. `AuditLog.At` без явного `HasColumnType` маппится Npgsql 8 в `timestamptz` и требует `Kind=Utc`.
- `Restock` грузит продукты одним запросом, инкременты применяет в памяти и делает один `SaveChangesAsync` на весь батч (не в цикле по строкам).
- `CreateProduct` использует `Add`, а не `AddAsync` — Guid генерируется на клиенте, обращение к БД для генерации ключа не требуется.

Тот же текст записан в `_answer.md`.