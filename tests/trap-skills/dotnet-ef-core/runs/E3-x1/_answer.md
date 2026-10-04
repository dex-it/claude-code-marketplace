Создан файл: /Users/anonymous/.cache/review/pr280/runs2/E3-X1/CatalogMaintenance.cs (новый, изменений в существующих файлах нет).

Решения:
- (а) `RaisePricesAsync` — `ExecuteUpdateAsync` вместо загрузки продуктов категории в память и трекинга: одна переводимая SQL UPDATE.
- (б) `PurgeOldAuditLogsAsync` — чистка батчами по 5000 строк через `DELETE ... WHERE Id IN (SELECT ... ORDER BY Id LIMIT n)` с паузой между батчами, а не один `ExecuteDeleteAsync`/DELETE без границ: при ~40 млн из ~50 млн строк под удаление один проход держал бы блокировку таблицы и разросшийся WAL часами. Cutoff строится из `DateTime.UtcNow` (Kind=Utc), т.к. `AuditLog.At` без `HasColumnType` в `OnModelCreating` маппится Npgsql 8 на `timestamptz`.
- (в) `RestockAsync` — сначала суммирует дубли id во входном списке в словарь (иначе один и тот же продукт грузился бы дважды и не все инкременты Stock сохранились бы), затем грузит продукты трекингом (нужен для записи) и делает один `SaveChangesAsync`.
- (г) `CreateProductAsync` — создаёт `Product` с `Guid.NewGuid()`, добавляет в контекст и сохраняет.
