Все задачи выполнены. Вот краткий отчёт:

**Созданные файлы:**
- `ReportService.cs` — сервис для годовой сводки с методом GetYearReportAsync, возвращает по месяцам статус закрытия и часы
- `001_UniqueProjectCode.cs` — миграция EF для добавления уникального ограничения на поле Project.Code
- `TimesheetsEndpoints.cs` — endpoints для задач (а) и (б): GET /reports/year/{year} и DELETE /clients/{id}/projects

**Изменённые файлы:**
- `AgencyDbContext.cs` — индекс Project.Code теперь уникальный (.IsUnique())
- `ProjectService.cs` — добавлен метод DeleteClientProjectsAsync для удаления всех проектов клиента
- `TimeEntryService.cs` — валидация в AddAsync и UpdateAsync на максимум 12 часов в день через ValidateDailyLimitAsync

**Решения:** (а) ReportService возвращает годовую сводку; (б) ProjectService удаляет проекты одним запросом; (в) уникальный индекс на Code защищен миграцией; (г) валидация на 12 часов/день выбросит InvalidOperationException (400) при превышении.

_answer.md записан в каталог.