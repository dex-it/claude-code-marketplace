## Созданные/изменённые файлы

- Создан: `CatalogMaintenance.cs` (namespace `Shop.Data`) — сервис с методами `RaisePricesAsync`, `CleanupOldAuditLogsAsync`, `RestockAsync`, `CreateProductAsync`.

## Решения

- Повышение цен и очистка `AuditLogs` реализованы как set-based `ExecuteUpdateAsync`/`ExecuteDeleteAsync` (EF Core 8), без материализации сущностей и без трекинга.
- Удаление старых `AuditLogs` (~40 млн из ~50 млн строк) идёт батчами по `Id` (по 5000), каждый батч — своя неявная транзакция `ExecuteDeleteAsync`, а не один DELETE на весь объём; фильтр по `At` сравнивается с `DateTime.UtcNow`, т.к. колонка без явного `HasColumnType` маппится Npgsql в `timestamp with time zone` и требует `Kind=Utc`.
- `RestockAsync` грузит нужные продукты одним запросом, суммирует дубликаты id и сохраняет одним `SaveChangesAsync` (без `SaveChanges` в цикле).
- `CreateProductAsync` генерирует `Guid` на клиенте и использует `Add`, а не `AddAsync`.

Ответ также записан в `_answer.md`.