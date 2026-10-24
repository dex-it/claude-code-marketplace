## Созданные/изменённые файлы
- Создан: `CatalogMaintenance.cs`

## Решения
- (a) `RaisePricesAsync` — bulk `ExecuteUpdateAsync` по категории, без загрузки сущностей в память (эффективно для больших категорий).
- (b) `PurgeOldAuditLogsAsync` — чистка пачками (`DELETE ... WHERE "Id" IN (SELECT ... ORDER BY "Id" LIMIT n)`) с паузой между пачками вместо одной транзакции на ~40 млн строк: так не разрастаются WAL/репликация, не держатся долгие блокировки и успевает автовакуум.
- (c)/(d) `RestockAsync` суммирует дубликаты id и применяет инкременты одним `SaveChangesAsync`; `CreateProductAsync` создаёт `Product` с `Guid.NewGuid()`.

Ответ также записан в `_answer.md`. Сборку/тесты не запускал по ограничению.