Создан файл: `CatalogMaintenance.cs` (namespace `Shop.Data`), ответ также сохранён в `_answer.md`.

Решения:
- **RaisePricesAsync** — массовый `ExecuteUpdateAsync` в БД без загрузки продуктов и без цикла с `SaveChanges`.
- **PurgeOldAuditLogsAsync** — удаление батчами через параметризованный `ExecuteSqlInterpolatedAsync` с `LIMIT`, каждый батч — отдельная транзакция (не одна на 40 млн строк); вызывающий код должен резолвить сервис из нового DI-scope на каждый ночной запуск, а не держать один `DbContext` постоянно.
- **RestockAsync** — продукты выбираются одним трекающим запросом, `Stock` правится напрямую (без `UpdateRange`), `SaveChangesAsync` вызывается один раз после цикла.
- **CreateProductAsync** — `Guid.NewGuid()` на клиенте, поэтому `Add`, а не `AddAsync`.