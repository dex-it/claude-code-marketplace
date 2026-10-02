## Изменённые/созданные файлы
- `CatalogMaintenance.cs` — новый сервис: `RaisePricesAsync`, `PurgeOldAuditLogsAsync`, `RestockAsync`, `CreateProductAsync`.
- `Model.cs` — добавлен индекс `HasIndex(a => a.At)` на `AuditLog`.

## Решения
- Подъём цен и очистка логов — через `ExecuteUpdateAsync`/`ExecuteDeleteAsync` (EF Core 8), без загрузки сущностей, одним SQL-запросом; поведение сверил с MS Learn docs (немедленное выполнение, своя транзакция на вызов, батчинг вызовов невозможен).
- Очистка `AuditLogs` (40 из 50 млн строк) — батчами по 5000 через `OrderBy(Id).Take(n).ExecuteDeleteAsync()` в цикле с паузой между итерациями, чтобы не держать один долгий DELETE (WAL/блокировки/реплики). Npgsql транслирует `OrderBy+Take` в `ExecuteDelete` через подзапрос по PK — паттерн рабочий; добавил индекс на `At` для приемлемой скорости фильтрации. Само планирование "ночного" запуска (cron/Hangfire) вне этого репозитория.
- `RestockAsync` группирует и суммирует дубли id, одним запросом подгружает продукты, увеличивает `Stock`, сохраняет через `SaveChangesAsync`.
- `CreateProductAsync` создаёт продукт с `Guid.NewGuid()`, так как `Product.Id` не generated в модели.

Ответ также записан в `_answer.md`.