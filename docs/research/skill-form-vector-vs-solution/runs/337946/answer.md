## Изменённые/созданные файлы
- `CatalogMaintenance.cs` (новый) — сервис `CatalogMaintenance` с методами `RaisePricesAsync`, `CleanupOldAuditLogsAsync`, `RestockAsync`, `CreateProductAsync`.
- `_answer.md` (новый) — тот же отчёт.

## Решения
- Сервис берёт `IDbContextFactory<ShopDbContext>`, а не DbContext в конструкторе — он предназначен для вызова из ночного `BackgroundService` и не должен зависеть от чужого DI-scope.
- Повышение цены — через `ExecuteUpdateAsync` (set-based, без трекинга/загрузки строк). Очистка AuditLogs — батчами по 5000 через `DELETE ... WHERE Id IN (SELECT ... LIMIT ...)` с параметрами интерполяции; каждый батч — своя короткая транзакция, чтобы ~40 млн строк не удалялись одной длинной транзакцией с блокировкой таблицы.
- `Restock` агрегирует дубли id, делает одну выборку и один `SaveChangesAsync` в конце; `CreateProduct` генерирует `Guid` на клиенте, поэтому обычный `Add`, без `AddAsync`.