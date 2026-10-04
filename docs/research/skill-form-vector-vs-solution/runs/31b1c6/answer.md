## Изменённые файлы
- `Models.cs` — сущность `LoginCode`; маскирование e-mail/паспорта вынесено в статические `Student.MaskEmail`/`MaskPassport`.
- `SchoolDbContext.cs`, `QueryFilters.cs` — `DbSet<LoginCode>` + школьный query filter.
- `Program.cs` — регистрация сервисов и 5 эндпоинтов из задания.

## Новые файлы
- `AppAuthService.cs`, `ReportService.cs`, `InstructorService.cs`, `ProgressService.cs`.

## Решения
- (а) Email сравнивается через транслируемый `ToLower()`, ответ `request` одинаков независимо от существования карточки (без утечки), поиск кода — `FirstOrDefault`, а не `Single` (совпадение не гарантированно уникально в домене).
- (б) Группировка/счёт — в SQL (`GroupBy`+`Count` до материализации); уволенные инструкторы подтягиваются через `IgnoreQueryFilters()` с ручным фильтром по `SchoolId`.
- (в) Список + ближайшее занятие — один SQL-запрос (коррелированный подзапрос), без N+1; маскирование — уже после материализации DTO.
- (г) Сумма минут через `SumAsync` (int, не nullable, без `!`); 56 часов — константа.

Подробности и список файлов записаны в `/home/mmx/.cache/research/runs/31b1c6/work/_answer.md`.