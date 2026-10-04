Созданные/изменённые файлы:
- `CatalogMaintenance.cs` (новый) — сервис с методами `RaisePricesAsync`, `CleanupOldAuditLogsAsync`, `RestockAsync`, `CreateProductAsync`.
- `Model.cs` (изменён) — добавлен `HasIndex(a => a.At)` для `AuditLog`, нужен под фильтрацию в ночной очистке (требует отдельной EF Core миграции — не генерировалась, т.к. сборка/тесты запрещены).

Решения:
- Подъём цен использует `ExecuteUpdateAsync` (EF Core 8) — один SQL `UPDATE` без загрузки строк; Restock/CreateProduct — обычный load/track/`SaveChangesAsync`, как явно требовалось в задании.
- Очистку AuditLogs (~40 из 50 млн строк) сделал батчами (по умолчанию 5000) без `ORDER BY` — чтобы Postgres использовал индекс по `At` для scan+limit, а не сортировал весь подходящий набор на каждой итерации; удаление каждого батча — отдельная короткая транзакция (`ExecuteDeleteAsync`) с паузой между батчами и опциональным `maxDuration`, чтобы не держать один долгий `DELETE`/лок и не раздувать WAL/bloat таблицы за одну ночь.
- В EF Core 8 `ExecuteDelete`/`ExecuteUpdate` не поддерживают `OrderBy`/`Take` в запросе, поэтому id для удаления сначала выбираются обычным `Where+Take` LINQ-запросом, а затем удаляются по списку id отдельным `ExecuteDeleteAsync`.

Тот же текст записан в `_answer.md`.