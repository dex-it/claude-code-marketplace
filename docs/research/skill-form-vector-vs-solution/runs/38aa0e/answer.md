## Изменённые/созданные файлы

- `Models.cs` — в `ServiceRequest` добавлены `ContactPhone` (необязательный) и `CompletionComment`.
- `HousingDbContext.cs` — конфигурация длины новых колонок. Миграцию на эти колонки надо сгенерировать отдельно (`dotnet ef migrations add`) — не запускал, т.к. сборка/команды EF вне ограничений задачи.
- `HousingService.cs` — (а) `Sort`/`Dir` в `RequestSearch`, `ORDER BY` из whitelist в `SearchAsync`; (б) `CloseRequestAsync` атомарным `ExecuteUpdateAsync` с условием `InProgress`, 409 при конфликте; (г) `ContactPhone` в `NewRequest`/`RequestCard`.
- `PlanService.cs` — `ReplacePlanAsync(houseId, items)`: обновляет совпавшие по `WorkCode` пункты, добавляет новые, явно удаляет выпавшие из `DbSet` (из-за `DeleteOrphansTiming = Never` в контексте простое удаление из навигации не сработало бы); история оставшихся пунктов не трогается.
- `Endpoints.cs` (новый) — `POST /requests/{id}/close` и `PUT /houses/{id}/plan`; слоя маршрутов в проекте не было, добавил минимальный API-файл.

## Решения
Сортировка реестра — через whitelist колонок/направления, а не интерполяцию пользовательской строки, с условным JOIN на `apartments`/`houses`. Закрытие заявки — одна условная `ExecuteUpdateAsync`-команда вместо read-then-write, чтобы не было гонки при параллельном закрытии. Замена плана удаляет лишние работы явным `Remove` из `DbSet`, а не разрывом навигационной связи, из-за отключённого `DeleteOrphansTiming`.

Тот же текст записан в `/home/mmx/.cache/research/runs/38aa0e/work/_answer.md`.