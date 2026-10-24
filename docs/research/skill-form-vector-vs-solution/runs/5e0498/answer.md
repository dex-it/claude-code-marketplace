## Созданные/изменённые файлы

- `ReportService.cs` (новый) — `GetYearSummaryAsync(year)` для сводки по месяцам.
- `Controllers/ReportsController.cs` (новый) — `GET /reports/year/{year}`.
- `Controllers/ClientsController.cs` (новый) — `DELETE /clients/{id}/projects`.
- `ProjectService.cs` (изменён) — `DeleteAllByClientAsync`.
- `AgencyDbContext.cs` (изменён) — уникальный частичный индекс по `Project.Code`.
- `Migrations/20261002120000_ProjectCodeUniqueIndex.cs` (новый).
- `TimeEntryService.cs` (изменён) — проверка дневного лимита 12 ч на `AddAsync`/`UpdateAsync` + `DailyHoursLimitExceededException`.
- `_answer.md` (новый) — тот же отчёт.

Ключевые решения: индекс по коду проекта сделан частичным (`WHERE NOT "IsDeleted"`), иначе ломается восстановление/повторное создание проекта под старым кодом; лимит часов считается по фактическому `EmployeeId` записи с исключением самой себя при редактировании; сводка по году агрегирует закрытые периоды в памяти, т.к. `YearMonth` — конвертируемый value object, не транслируемый в SQL по `.Year`/`.Month`. В каталоге нет `Program.cs`/`.csproj`/истории миграций — Designer/Snapshot для EF-миграции нужно дособрать штатным `dotnet ef migrations add` перед сборкой efbundle.