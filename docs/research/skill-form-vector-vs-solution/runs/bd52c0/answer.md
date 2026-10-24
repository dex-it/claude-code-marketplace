## Созданные/изменённые файлы

- `CatalogMaintenance.cs` — новый сервис: `RaisePricesAsync(category)`, `PurgeOldAuditLogsAsync(...)`, `RestockAsync(deltas)`, `CreateProductAsync(sku, ...)`.
- `AuditLogPurgeHostedService.cs` — новый `BackgroundService`, ежедневно (03:00 UTC) запускающий `PurgeOldAuditLogsAsync` в своём DI-scope.
- `Model.cs` — добавлены индексы `AuditLog.At` и `Product.Category`, без которых обе bulk-операции упрутся в full scan 50-миллионной/каталожной таблицы.
- `_answer.md` — этот же ответ.

## Решения

Повышение цен на 10% сделано одним `ExecuteUpdateAsync` (UPDATE на сервере без загрузки сущностей); Restock грузит только запрошенные Guid'ы через `Contains`. Для очистки AuditLogs (50 млн строк, ~40 млн под удаление) единый `ExecuteDeleteAsync`/`DELETE` неприемлем (долгая транзакция, распухание WAL и блокировки), а `Take()`/`Skip()` в `ExecuteDelete` Npgsql не транслирует — поэтому удаление идёт батчами по 5000 через raw SQL с подзапросом `LIMIT` и паузой между батчами, что подтверждено доступной документацией EF Core 8 по `ExecuteUpdate`/`ExecuteDelete`. Ночной запуск вынесен в отдельный `BackgroundService` со своим scope, регистрацию в хосте (`Program.cs`) не добавлял — такого файла в каталоге нет.