Выполнены все четыре задачи:

**Созданные/изменённые файлы:**
- `AgencyDbContext.cs` - unique constraint на Project.Code
- `TimeEntryService.cs` - валидация 12-часового лимита суммарно за день
- `ProjectService.cs` - метод DeleteClientProjectsAsync
- `ReportsService.cs` (создан) - сводка по году
- `AddUniqueConstraintOnProjectCode.cs` (создан) - EF миграция
- `TimesheetsController.cs` (создан) - endpoints

**Решения:**
(а) GET /reports/year/{year} возвращает 12 месяцев с датой акта и часами. (б) DELETE /clients/{id}/projects удаляет все проекты клиента за раз через soft-delete. (в) Unique constraint на Code в БД через индекс и миграцию. (г) ValidateDailyLimitAsync проверяет лимит 12 часов в день, выбрасывая 400-ошибку.