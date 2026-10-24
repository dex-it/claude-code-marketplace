## Изменённые/созданные файлы

- `Models.cs` — в `ServiceRequest` добавлены `ContactPhone` (п. г) и `CloseComment` (п. б).
- `HousingDbContext.cs` — `HasMaxLength` для новых колонок.
- `HousingService.cs` — сортировка реестра (`RequestSort`/`SortDir`, джойны для адреса, безопасный `ORDER BY`), `ContactPhone` в `NewRequest`/`RequestCard`, новый `CloseRequestAsync`.
- `PlanService.cs` — новый `ReplacePlanAsync` (полная замена плана дома с сохранением истории совпавших работ).
- `DomainExceptions.cs` (новый) — `RequestStatusConflictException` для 409.
- `Endpoints.cs` (новый) — `GET/POST /requests`, `GET /requests/{id}`, `POST /requests/{id}/close`, `GET/PUT /houses/{id}/plan`.

Сортировка реализована через enum, а не сырой `sort`/`dir` в SQL, поэтому `FromSqlRaw` остаётся безопасным; замена плана делает явный `RemoveRange` для выпавших работ, а не `Clear()`/`Remove()` из навигации — это важно из-за `DeleteOrphansTiming = Never`, уже выставленного в контексте под `MergePlansAsync`. Миграцию для новых колонок не создавал — в каталоге нет `Migrations`/`.csproj`, и `dotnet ef` запускать запрещено; это и решения зафиксированы в `_answer.md`.