## Изменённые файлы
- `Models.cs` — у `ServiceRequest` добавлены `ContactPhone` (необязательный) и `ClosingComment`.
- `HousingDbContext.cs` — ограничения длины для новых колонок.
- `HousingService.cs` — `RequestSearch` получил `Sort`/`Dir` (whitelist `date|address|status`/`asc|desc`, подставляется в `ORDER BY` литералом, не как пользовательский ввод); `RequestCard`/`NewRequest` дополнены телефоном; добавлен `CloseRequestAsync` (комментарий обязателен, закрытие только из `InProgress`, иначе `RequestConflictException`).
- `PlanService.cs` — `PlanItemInput` + `ReplacePlanAsync`: план приводится к присланному списку по `WorkCode`, удалённые работы уходят каскадом вместе со своей историей, история оставшихся не трогается.

## Новые файлы
- `Exceptions.cs` — `RequestConflictException` (мапится в 409).
- `RequestsController.cs` — `GET /requests` (sort/dir), `GET /requests/{id}`, `POST /requests`, `POST /requests/{id}/close`.
- `HousesController.cs` — `GET` и `PUT /houses/{id}/plan`.

## Решения
Сортировка реестра — через whitelist допустимых значений, а не интерполяцию query-параметров в SQL. Замена плана дома использует тот же приём, что и `MergePlansAsync` (разрыв required-связи при `DeleteOrphansTiming = Never` → каскадное удаление истории только у выброшенных работ). Миграцию под новые колонки не сгенерировал — в каталоге нет проекта/папки `Migrations`, а сборку запускать нельзя по условию задачи.

Тот же текст записан в `/home/mmx/.cache/research/runs/eb822b/work/_answer.md`.