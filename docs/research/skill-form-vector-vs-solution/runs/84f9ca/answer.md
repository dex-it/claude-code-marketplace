## Изменённые/созданные файлы

- **CatalogMaintenance.cs** (новый) — сервис с методами `RaisePricesAsync`, `CleanupOldAuditLogsAsync`, `RestockAsync`, `CreateProductAsync`.
- **Model.cs** (изменён) — добавлен `HasIndex(a => a.At)` на `AuditLog` (нужна миграция).

## Решения

- Поднятие цен реализовано через `ExecuteUpdateAsync` (bulk UPDATE на сервере) — без загрузки продуктов категории в память.
- Очистка `AuditLogs` (50 млн строк, ~40 млн под удаление) идёт батчами по 5000 через `DELETE ... WHERE Id IN (SELECT ... ORDER BY At LIMIT n)` с паузой между итерациями — чтобы не держать одну гигантскую транзакцию/лок и не раздувать WAL; для этого добавлен индекс по `At`.
- `RestockAsync` берёт все продукты одним запросом и инкрементирует `Stock`, `CreateProductAsync` создаёт `Product` с новым `Guid`.

Сборка и тесты не запускались (по ограничению задачи); тот же текст сохранён в `_answer.md`.