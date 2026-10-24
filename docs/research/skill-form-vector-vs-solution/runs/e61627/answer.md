## Результат

**Созданные/изменённые файлы:**
- `Migrations/20261002_AddUniqueConstraintOnProjectCode.cs` — миграция с unique constraint на Project.Code
- `AgencyDbContext.cs` — конфигурация unique index с фильтром по soft-delete
- `ReportService.cs` — сервис для сводки по годам (месяцы, дата подписания актов, часы)
- `ProjectService.cs` — метод DeleteClientProjectsAsync для удаления всех проектов клиента одной операцией
- `TimeEntryService.cs` — валидация ограничения 12 часов/день с новым исключением DailyHoursExceededException

**Решения кратко:**
- **(а)** ReportService.GetYearReportAsync агрегирует часы по месяцам и джойнит даты подписания из ClosedPeriods через YearMonth.
- **(б)** DeleteClientProjectsAsync загружает и удаляет проекты пакетом в одной транзакции; soft-delete работает через SaveChangesAsync override.
- **(в)** Unique index на Project.Code с фильтром `IsDeleted = false` на уровне БД плюс проверка в CreateAsync; миграция идёт стандартным releasом через efbundle.
- **(г)** ValidateDailyHoursAsync при добавлении проверяет новые часы, при правке — только прирост (если отрицательный, проверка не срабатывает); исключение с HTTP 400.