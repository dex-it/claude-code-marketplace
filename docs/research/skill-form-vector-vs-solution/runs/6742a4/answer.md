Все задачи выполнены.

## Созданные/изменённые файлы

**Новые:**
- ReportService.cs
- Migrations/20261002000000_MakeProjectCodeUnique.cs
- Migrations/AgencyDbContextModelSnapshot.cs

**Изменённые:**
- TimeEntryService.cs (добавлена ValidateDailyHoursAsync)
- ProjectService.cs (добавлен DeleteProjectsByClientAsync)
- AgencyDbContext.cs (Index.IsUnique)

## Решения

(а) ReportService.GetYearReportAsync строит сводку за год, подтягивая часы из TimeEntries и даты актов из ClosedPeriods через словари в один проход.

(б) DeleteProjectsByClientAsync загружает проекты клиента и удаляет за раз; soft-delete срабатывает в SaveChangesAsync через change tracker.

(в) Миграция переиндексирует Project.Code как UNIQUE; уникальность на БД подстраховывает на уровне схемы; выкатка через efbundle в pipeline.

(г) ValidateDailyHoursAsync суммирует часы сотрудника в день (исключая обновляемую запись), возвращает 400 при превышении 12 часов.