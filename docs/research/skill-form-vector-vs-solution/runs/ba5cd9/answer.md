Создан файл: `CatalogMaintenance.cs` (класс `Shop.Data.CatalogMaintenance`). Тот же текст записан в `_answer.md`.

Решения:
- (а) `RaisePricesAsync` — `ExecuteUpdateAsync` одним SQL-запросом вместо загрузки продуктов в Change Tracker.
- (б) `CleanupOldAuditLogsAsync` — удаление батчами по 1000 через `Where(...).OrderBy(Id).Take(batchSize).ExecuteDeleteAsync()` с задержкой между батчами (не одна транзакция на ~40 млн строк); DbContext подразумевается Scoped, метод рассчитан на вызов из scope (например, из BackgroundService через `IServiceScopeFactory`).
- (в) `RestockAsync` — агрегирует дубликаты id в словарь дельт, грузит продукты одним запросом (`Contains`, без N+1), меняет `Stock` в памяти, один `SaveChangesAsync`.
- (г) `CreateProductAsync` — `Guid.NewGuid()` на клиенте, `Add()` (не `AddAsync`), один `SaveChangesAsync`.