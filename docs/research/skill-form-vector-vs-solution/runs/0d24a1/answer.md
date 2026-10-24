Готово! Выполнил все четыре поручения:

## Созданные/изменённые файлы:

1. **AgencyDbContext.cs** — IsUnique() для индекса Code
2. **Migrations/20261002_MakeProjectCodeUnique.cs** — миграция с уникальным ограничением
3. **TimeEntryService.cs** — валидация 12 часов/день через EnsureDailyLimitAsync
4. **ProjectService.cs** — DeleteProjectsByClientAsync для массового удаления
5. **ReportService.cs** — YearSummary с группировкой в SQL
6. **TimesheetsController.cs** — endpoints GET /reports/year/{year} и DELETE /clients/{id}/projects

## Решения:

**(а)** Сводка по месяцам через GroupBy и Sum в SQL без загрузки полных записей.
**(б)** ExecuteUpdateAsync вместо цикла — одна операция для всех проектов клиента.
**(в)** Уникальный индекс в миграции с фильтром `IsDeleted=false` предотвращает дубликаты на уровне БД.
**(г)** Проверка суммы часов за день при add/update, разница часов в update корректна.