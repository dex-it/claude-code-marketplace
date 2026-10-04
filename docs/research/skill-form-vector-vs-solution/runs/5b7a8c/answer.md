## Выполнено

**Созданные файлы:**
- `ReportService.cs` — сервис для GET /reports/year/{year}
- `Controllers/ReportsController.cs` — контроллер отчётов
- `Controllers/ProjectsController.cs` — контроллер для DELETE /clients/{id}/projects
- `Migrations/20261002_AddUniqueConstraintProjectCode.cs` — миграция уникальности кода

**Изменённые файлы:**
- `AgencyDbContext.cs` — уникальный индекс Code с фильтром IsDeleted
- `ProjectService.cs` — метод DeleteAllClientProjectsAsync
- `TimeEntryService.cs` — проверка лимита 12 часов в день

**Решения:**

**(a)** ReportService группирует часы TimeEntry по месяцам и объединяет с ClosedPeriods для даты подписания акта; возвращает сводку за все 12 месяцев года.

**(б)** DeleteAllClientProjectsAsync загружает проекты клиента одним запросом и удаляет через soft-delete, SaveChangesAsync установит IsDeleted и DeletedAt.

**(в)** Добавлен уникальный индекс с фильтром `"IsDeleted" = false`, позволяет восстанавливать проекты с тем же кодом; миграция переиндексирует Code.

**(г)** EnsureDailyLimitAsync проверяет сумму часов сотрудника за день при AddAsync и UpdateAsync (исключая текущую запись), бросает исключение при превышении 12 часов.