## Созданные/изменённые файлы

- `ReportService.cs` (новый) — `GetYearSummaryAsync`, модели `MonthSummary`/`YearSummary`.
- `ClientService.cs` (новый) — `DeleteAllProjectsAsync` (массовое мягкое удаление проектов клиента).
- `Endpoints.cs` (новый) — `GET /reports/year/{year}` и `DELETE /clients/{id}/projects`.
- `AgencyDbContext.cs` — индекс `Project.Code` заменён на уникальный фильтрованный (`WHERE "IsDeleted" = false`).
- `ProjectService.cs` — `CreateAsync` теперь ловит `DbUpdateException`/`PostgresException(23505)` от нового индекса.
- `TimeEntryService.cs` — проверка дневного лимита 12 ч (`EnsureDailyLimitAsync`) в `AddAsync`/`UpdateAsync`, новый `DailyHoursExceededException`.
- `Migrations/20261002120000_ProjectCodeUniqueIndexFiltered.cs` (новый) — меняет `IX_Projects_Code` на уникальный фильтрованный `IX_Projects_Code_Active`.

## Решения

Код уникален только среди активных проектов (частичный индекс), т.к. после удаления код можно переиспользовать (см. `RestoreProjectAsync`); `CreateAsync` дополнительно страхуется от гонки при одновременных запросах. Новое исключение дневного лимита наследуется от `InvalidOperationException`, как и существующий `ClosedPeriodException`, чтобы попасть под уже имеющуюся конвертацию в 400 без правок во внешнем коде обработки ошибок. Отчёт и массовое удаление реализованы напрямую через `TimeEntries`/`ClosedPeriods`/`ISoftDeletable`, без новых абстракций.

Миграция написана вручную (без запуска `dotnet ef`) и не включает обновление `ModelSnapshot` — перед сборкой efbundle её стоит перегенерировать штатной командой в полном репозитории. То же самое записано в `_answer.md`.