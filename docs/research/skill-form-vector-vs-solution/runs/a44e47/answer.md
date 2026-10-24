**Изменённые/созданные файлы:**
- `CatalogMaintenanceService.cs` (создан) — сервис с `RaisePricesAsync`, `CleanupOldAuditLogsAsync`, `RestockAsync`, `CreateProductAsync`.
- `Model.cs` (изменён) — для `AuditLog.At` добавлены `HasColumnType("timestamp without time zone")` и индекс `HasIndex(a => a.At)`.
- `_answer.md` (создан) — тот же текст ответа.

**Решения:** повышение цен и очистка audit-логов сделаны через `ExecuteUpdateAsync`/`ExecuteDeleteAsync` (EF Core 8) без загрузки сущностей; очистка ~40 млн из ~50 млн строк идёт батчами по индексированному подзапросу (`OrderBy(Id).Take(batchSize)`), а не одним `DELETE`, чтобы не раздувать WAL и не держать долгие блокировки. Cutoff-дата для сравнения с `At` создаётся с `DateTimeKind.Unspecified`, т.к. колонка замаплена как `timestamp without time zone`, а Npgsql 8 требует совпадения Kind с типом колонки. `Restock`/`CreateProduct` реализованы через обычный `SaveChanges`, как требовалось в задаче.