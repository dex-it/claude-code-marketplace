## Изменённые файлы
- `AgencyDbContext.cs` — индекс `Code` у `Project` сделан уникальным частичным (`WHERE "IsDeleted" = false`).
- `ProjectService.cs` — добавлен `DeleteAllForClientAsync(clientId)`.
- `TimeEntryService.cs` — добавлена проверка `EnsureDailyLimitAsync` (суточный лимит 12ч по всем проектам) в `AddAsync`/`UpdateAsync` + `DailyHoursLimitExceededException`.

## Новые файлы
- `ReportService.cs` + `ReportsEndpoints.cs` — `GET /reports/year/{year}`.
- `ClientsEndpoints.cs` — `DELETE /clients/{id}/projects`.
- `TimeEntriesEndpoints.cs` — `POST`/`PUT /time-entries...`, мапит бизнес-исключения в 400/404.
- `Migrations/20261002090000_ProjectCodeUniqueIndex.cs` — частичный уникальный индекс на `Projects.Code`.

## Решения
Уникальность кода проекта перенесена в частичный (`WHERE "IsDeleted" = false`) уникальный индекс в БД — это закрывает гонку в `CreateAsync`, но сохраняет уже заложенное поведение повторного использования кода после мягкого удаления. Суточный лимит считается отдельным запросом по `EmployeeId+WorkDate` с исключением текущей записи при правке, что корректно обрабатывает перенос записи на другую дату. Каталог содержал только 4 файла модели/сервисов без `Program.cs`/`.csproj`/папки `Migrations` — endpoint'ы оформлены как `IEndpointRouteBuilder`-расширения для подключения в реальном `Program.cs`, а миграция написана вручную (без Designer/snapshot — их нужно перегенерировать `dotnet ef migrations add` в полном репозитории). Подробности и ограничение — в `_answer.md`.