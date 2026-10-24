Готово! Создал и обновил необходимые файлы.

## Созданные/изменённые файлы:
- **ReportService.cs** — новый сервис для годовой сводки (GET /reports/year/{year})
- **ProjectService.cs** — метод `DeleteProjectsForClientAsync` для удаления всех проектов клиента
- **Migrations/20261002_AddUniqueConstraintToProjectCode.cs** — миграция с уникальным индексом
- **AgencyDbContext.cs** — конфигурация уникального индекса на Project.Code
- **TimeEntryService.cs** — валидация максимум 12 часов в день на add/update

## Решения:

(a) **ReportService** группирует часы в SQL (SUM + GROUP BY по месяцу), ClosedPeriods загружает no-tracking запросом отдельно. Соединение происходит в памяти (Skill: агрегаты в SQL, трекинг только необходимый).

(b) **DeleteProjectsForClientAsync** батчит удаление всех проектов в одном SaveChanges через soft-delete (HasQueryFilter автоматически исключает).

(c) **Миграция** добавляет уникальный индекс с фильтром `IsDeleted = false`, позволяя удалённым проектам переиспользовать коды. Выкатка через efbundle как SQL-артефакт (Skill: миграция на production как готовый артефакт).

(d) **EnsureDailyLimitAsync** проверяет сумму часов в SQL перед материализацией, при update вычисляет разницу и исключает текущую запись из подсчёта (Skill: фильтр в SQL, не в памяти).