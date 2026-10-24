## Изменённые/созданные файлы

- `Models.cs` — в `ServiceRequest` добавлены `ContactPhone` (необязательный) и `CompletionComment`.
- `HousingDbContext.cs` — ограничения длины для новых колонок.
- `HousingService.cs` — сортировка реестра (`sort`/`dir` через whitelist SQL-фрагментов, JOIN на `apartments`/`houses` добавлен и для сортировки по адресу), `CloseRequestAsync` (409 при не-`InProgress`, обязательный комментарий), `ContactPhone`/`CompletionComment` в DTO.
- `PlanService.cs` — `ReplacePlanAsync`: план приводится к присланному списку по `WorkCode`, лишние работы удаляются явным `Remove` сущности (не через коллекцию — разрыв required-связи при `DeleteOrphansTiming = Never`), история оставшихся работ не трогается.
- `Endpoints.cs` (новый) — `POST /requests/{id}/close` и `PUT /houses/{id}/plan`.

Сортировка собрана из фиксированного набора SQL-выражений (не из сырого пользовательского ввода), а удаление работ из плана сделано через `DbSet.Remove`, а не отсоединением от навигации, из-за required-связи и `DeleteOrphansTiming = Never` в контексте. Миграцию под новые колонки не создавал — в этом срезе репозитория нет `.csproj`/`Migrations`, нужно сгенерировать `dotnet ef migrations add` отдельно. Ответ также записан в `_answer.md`.