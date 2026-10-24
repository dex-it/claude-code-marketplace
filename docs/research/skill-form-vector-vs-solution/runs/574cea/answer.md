## Изменённые/созданные файлы

- `TimeEntryService.cs` (изменён) — суточный лимит 12 ч по всем проектам сотрудника, проверка в `AddAsync`/`UpdateAsync`, новое исключение `DailyHoursLimitExceededException`.
- `AgencyDbContext.cs` (изменён) — частичный уникальный индекс `Projects.Code` (только среди неудалённых строк).
- `Migrations/20261002120000_AddUniqueProjectCodeIndex.cs` (новый) — миграция на этот индекс.
- `ReportService.cs` (новый) — `YearSummaryAsync`: закрытость месяца + дата акта + часы за месяц.
- `ReportEndpoints.cs` (новый) — `GET /reports/year/{year}`.
- `ClientService.cs` (новый) — `DeleteAllProjectsAsync` одним `ExecuteUpdateAsync`.
- `ClientEndpoints.cs` (новый) — `DELETE /clients/{id}/projects`.

Ключевые решения: индекс сделан частичным (`WHERE "IsDeleted" = false`), иначе ломался бы повторный код после удаления проекта; массовое удаление — один SQL `UPDATE` без построчной загрузки; лимит часов считается по сотруднику+дню по всем проектам, с исключением самой правимой записи при Update. Так как в каталоге нет полного EF-проекта, Designer/Snapshot-файлы миграции не перегенерированы — это нужно сделать `dotnet ef migrations add` в реальном репозитории перед сборкой efbundle (отмечено в `_answer.md`).