## Готово!

**Созданные/изменённые файлы:**
- `TimeEntryService.cs` — валидация макс. 12 часов в день при Add и Update
- `ProjectService.cs` — новый метод `DeleteClientProjectsAsync` для удаления всех проектов клиента
- `AgencyDbContext.cs` — индекс Code сделан уникальным (IsUnique())
- `Migrations/001_MakeProjectCodeUnique.cs` — миграция БД с переводом индекса на unique
- `ReportService.cs` — сервис с `GetYearReportAsync` для сводки за год (месяцы, даты закрытия, часы)

**Краткие решения:**
- (а) Метод группирует часы по месяцам до материализации (GroupBy до ToListAsync), объединяет с ClosedPeriods в памяти, возвращает DTO с полной информацией.
- (б) DeleteClientProjectsAsync загружает проекты клиента и удаляет их через Remove/SaveChangesAsync, работает с soft-delete логикой контекста.
- (в) Уникальный индекс на Code в модели и миграции — выкатится стандартным efbundle релизом в pipeline.
- (г) ValidateDailyHoursAsync считает текущие часы сотрудника за день и исключает редактируемую запись при Update, выбрасывает 400 (InvalidOperationException) при превышении 12ч.