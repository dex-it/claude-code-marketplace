## Выполнено

**Созданные/изменённые файлы:**
- TimeEntryService.cs (добавлена валидация 12 часов/день: `EnsureDailyLimitAsync` + `DailyHourLimitException`)
- ProjectService.cs (добавлен `DeleteAllByClientIdAsync`)
- ReportService.cs (новый сервис с `GetYearReportAsync`)
- AgencyDbContext.cs (индекс Code сделан уникальным через `IsUnique()`)
- Migrations/20261002000000_MakeProjectCodeUnique.cs (миграция EF Core)

**Решения:**
- **(а)** ReportService итерирует по месяцам, суммирует часы из TimeEntries и подтягивает даты закрытия из ClosedPeriods;
- **(б)** DeleteAllByClientIdAsync загружает проекты клиента и удаляет их за один вызов SaveChangesAsync (soft delete);
- **(в)** Уникальный индекс добавлен в OnModelCreating, миграция Drop/Create индекса поддерживает откат через efbundle;
- **(г)** EnsureDailyLimitAsync проверяет сумму часов за день при добавлении/правке, выбросит исключение при превышении 12ч (контроллер маппит на 400).

Все решения соответствуют архитектуре проекта (soft delete, async/await, EF Core patterns, Npgsql).