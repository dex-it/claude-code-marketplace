Создан файл: /Users/anonymous/.cache/review/pr280/runs2/E3-X2/CatalogMaintenance.cs (новый, изменений в существующих файлах нет).

Решения:
- (а) переоценка и (б) чистка AuditLogs сделаны через `ExecuteUpdateAsync`/`ExecuteDeleteAsync` (без загрузки строк и без трекинга); чистка идёт пачками по id (без явного `HasColumnType` у `AuditLog.At` колонка - `timestamptz`, поэтому сравнение через `DateTime.UtcNow`), чтобы не держать одну транзакцию на ~40 млн строк и не запирать таблицу целиком.
- (в) `RestockAsync` схлопывает дубли id во входном списке суммированием перед загрузкой сущностей (иначе результат зависел бы от порядка тюплов), сама загрузка - с трекингом, т.к. сущности меняются и сохраняются в этом же контексте.
- (г) `CreateProductAsync` создаёт `Product` с `Guid.NewGuid()` и параметрами sku/category/price/stock/warehouse.
