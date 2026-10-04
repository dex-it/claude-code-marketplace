## Результат

Созданы/изменены 7 файлов:

1. **ReportService.cs** - новый сервис с методом GetYearReportAsync для получения сводки за год (месяцы, даты закрытия, часы)
2. **ProjectService.cs** - добавлен метод DeleteAllProjectsByClientAsync для удаления всех проектов клиента
3. **TimeEntryService.cs** - добавлена валидация дневного лимита 12 часов с методом ValidateDailyLimitAsync и исключением DailyLimitExceededException
4. **AgencyDbContext.cs** - обновлена конфигурация индекса Project.Code на уникальный с фильтром IsDeleted=false
5. **Migrations/20261002120000_UniqueProjectCode.cs** - миграция для переделки индекса
6. **Migrations/AgencyDbContextModelSnapshot.cs** - снимок конфигурации моделей
7. **_answer.md** - документация решений

**Решения:** (а) ReportService возвращает YearMonthReport с датой акта и часами за каждый месяц. (б) DeleteAllProjectsByClientAsync удаляет все проекты клиента в одной транзакции через soft-delete. (в) Уникальный индекс на Project.Code с фильтром для активных проектов обеспечивает целостность на БД. (г) ValidateDailyLimitAsync проверяет 12-часовой лимит перед добавлением и редактированием записей.