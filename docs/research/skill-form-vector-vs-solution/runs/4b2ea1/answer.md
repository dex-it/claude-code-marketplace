## Выполнено

Реализовал все четыре задачи:

**Созданные/изменённые файлы:**
- **TimeEntryService.cs** — валидация 12 часов/день в методе `ValidateDailyHoursAsync`
- **ProjectService.cs** — метод `DeleteClientProjectsAsync(int clientId)` для массового удаления проектов
- **ReportService.cs** — сервис с методом `GetYearReportAsync(year)` для сводки по месяцам
- **ReportsController.cs** — endpoint `GET /reports/year/{year}`
- **ClientsController.cs** — endpoint `DELETE /clients/{id}/projects`
- **AgencyDbContext.cs** — UNIQUE индекс на `Code` с фильтром `IsDeleted = false`
- **Migrations/20261002000000_AddUniqueConstraintOnProjectCode.cs** — миграция для уникального индекса
- **Migrations/AgencyDbContextModelSnapshot.cs** — снимок модели EF Core

**Решения:** валидация 12 часов выбрасывает исключение перед сохранением; удаление проектов использует встроенный soft-delete; уникальность кода гарантирована на уровне БД через фильтруемый индекс (позволяет повторно использовать коды удалённых проектов).