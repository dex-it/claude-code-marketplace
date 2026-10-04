## Изменённые/созданные файлы
- Создан: `CatalogMaintenance.cs` (namespace `Shop.Data`, класс `CatalogMaintenance`)

## Решения
- (а) Поднятие цен — через `ExecuteUpdateAsync` (EF Core 8), одна SQL-команда `UPDATE` без загрузки строк в память.
- (б) Очистка `AuditLogs` — не единый `ExecuteDelete`: при ~40 млн строк на удаление это дало бы гигантскую блокировку и распухание WAL/bloat. Удаление батчами по `Id` через подзапрос с `LIMIT` (в Postgres нет `DELETE ... LIMIT` напрямую), с паузой между батчами, пока всё не удалится.
- (в)/(г) `Restock` агрегирует дубли id перед загрузкой, обновляет `Stock` одним `SaveChangesAsync`; `CreateProduct` создаёт `Product` с `Guid.NewGuid()` и сохраняет.

Ответ также записан в `_answer.md`.