## Изменённые файлы
- `Models.cs` — добавлена сущность `LoginCode` (хеш кода, срок действия, флаг использования).
- `SchoolDbContext.cs` — `DbSet<LoginCode>`, маппинг (индекс StudentId+ExpiresAt, каскад на Student).
- `QueryFilters.cs` — глобальный фильтр по SchoolId для `LoginCode`.
- `Program.cs` — регистрация новых сервисов и endpoints: `POST /api/app/login/request`, `POST /api/app/login/confirm`, `GET /api/app/progress`, `GET /api/instructor/students`, `GET /api/reports/graduates`.

## Новые файлы
- `StudentAppService.cs` — вход по одноразовому коду (поиск e-mail через `EF.Functions.ILike`, без учёта регистра; код хранится как SHA-256-хеш, живёт 10 минут; ответ на `request` не раскрывает, есть ли такой e-mail) и прогресс по часам вождения (`SumAsync(Minutes)` по занятиям с `Done`, из 56 часов).
- `InstructorAppService.cs` — список учеников инструктора (`Status == Learning`), замаскированных тем же методом `MaskForInstructor()`, что и в CSV-выгрузке, плюс ближайшее незавершённое занятие одним сгруппированным запросом (без N+1).
- `ReportsService.cs` — отчёт о выпускниках по годам: подсчёт в БД через `GroupBy` на `Students`, затем список инструкторов получен через `IgnoreQueryFilters()` (чтобы не терять уволенных) с явным восстановлением `SchoolId == db.SchoolId`, иначе отчёт утёк бы между автошколами.

## Решения
Код входа сравнивается по хешу прямо в SQL-запросе (транслируемо), а для отчёта по выпускникам пришлось вручную восстановить SchoolId после `IgnoreQueryFilters()`, так как этот фильтр у Instructor совмещён с условием soft-delete — без этого отчёт показывал бы инструкторов всех автошкол. Для списка учеников инструктора ближайшее занятие вычисляется одним `GROUP BY`-запросом по всем studentId сразу, а не в цикле.

Тот же текст записан в `_answer.md`.