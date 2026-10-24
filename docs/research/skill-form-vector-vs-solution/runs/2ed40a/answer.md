## Результат

Выполнены все четыре задачи:

**Созданные/изменённые файлы:**
- TimeEntryService.cs — валидация макс 12 часов в день
- ProjectService.cs — метод DeleteAllClientProjectsAsync
- ReportService.cs — новый сервис для годовой сводки
- AgencyDbContext.cs — уникальный индекс на Project.Code
- Migrations/20261002_AddUniqueIndexOnProjectCode.cs — миграция
- ReportsController.cs, ClientsController.cs — контроллеры для endpoints

**Краткие решения:**
(а) ReportService агрегирует часы по месяцам и объединяет с ClosedPeriods. (б) Soft-delete всех проектов клиента в одной транзакции. (в) Уникальный индекс на уровне БД через миграцию. (г) Валидация при добавлении/редактировании проверяет суточную норму, вернёт 400 при превышении.