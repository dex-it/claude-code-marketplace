Создан файл `CatalogMaintenance.cs` (тот же текст записан в `_answer.md`).

**Файлы:**
- `CatalogMaintenance.cs` (новый) — сервис с методами `RaisePricesAsync`, `PurgeOldAuditLogsAsync`, `RestockAsync`, `CreateProductAsync`.

**Ключевые решения:**
- (а)/(б) через `ExecuteUpdateAsync`/`ExecuteDeleteAsync` (EF Core 8) — без выборки и трекинга; удаление AuditLogs — батчами по `Id` (подзапрос `OrderBy+Take+Contains`, т.к. `ExecuteDelete` не поддерживает `Skip/Take`), каждый батч — своя короткая транзакция вместо одной на ~40 млн строк.
- (в) дедупликация входных дельт по `id`, одна выборка + один `SaveChangesAsync` в конце (без `SaveChanges` в цикле, без `UpdateRange` по уже отслеживаемым сущностям).
- (г) `Guid` генерируется на клиенте → используется `Add`, а не `AddAsync`; cutoff для очистки берётся из `DateTime.UtcNow`, поскольку Npgsql 8 требует `Kind=Utc` для `timestamp with time zone` (тип по умолчанию для `DateTime`-колонки без явной конфигурации).