Изменённые/созданные файлы:
- `Models.cs` — в `ServiceRequest` добавлены `ContactPhone` (необязательный) и `CloseComment`.
- `HousingDbContext.cs` — ограничение длины `ContactPhone`.
- `HousingService.cs` — `RequestSearch.Sort/Dir` (date|address|status, asc|desc) с безопасной сборкой JOIN/ORDER BY по белому списку; `CloseRequestAsync` (409 через `RequestConflictException`, если заявка не в `InProgress`, обязательный комментарий); телефон в `NewRequest`/`RequestCard`, комментарий закрытия в `RequestCard`.
- `PlanService.cs` — `ReplacePlanAsync`: план приводится к присланному списку работ по `WorkCode`, история (`PlanItemCompletion`) сохраняется для оставшихся работ, удалённые из плана работы удаляются вместе с историей.
- `Endpoints.cs` (новый) — `POST /requests/{id}/close` (404/400/409) и `PUT /houses/{id}/plan` (400 при дублях кодов).
- `_answer.md` (новый) — тот же отчёт.

Решения: сортировка реестра — белый список полей/направлений + условные JOIN'ы, чтобы не ломать старые фильтры и избежать SQL-инъекции; история плана сохраняется сопоставлением по `WorkCode` (апдейт на месте вместо пересоздания); миграция EF для новых колонок не создана, т.к. в каталоге нет проекта/Migrations и запускать `dotnet ef` было запрещено — её нужно сгенерировать отдельно перед деплоем через `efbundle`.