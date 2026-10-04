## Изменённые файлы
- `Models.cs` — добавлена сущность `LoginCode` (код, срок действия UTC, флаг использования).
- `SchoolDbContext.cs` — `DbSet<LoginCode>`, конфигурация (длина кода, индекс по StudentId, FK на Student с каскадом).
- `QueryFilters.cs` — query filter по SchoolId для `LoginCode`.
- `Program.cs` — DI для новых сервисов, 5 новых эндпоинтов в группе `/api`.

## Новые файлы
- `StudentAppService.cs` — вход по коду (`/api/app/login/request`, `/api/app/login/confirm`) и прогресс (`/api/app/progress`).
- `ReportsService.cs` — отчёт по выпускникам (`/api/reports/graduates`).
- `InstructorAppService.cs` — список учеников инструктора (`/api/instructor/students`).

## Решения
Поиск карточки по e-mail без учёта регистра (`Email.ToLower() == email.ToLower()`, `FirstOrDefaultAsync` вместо `Single`, т.к. уникальность без учёта регистра не гарантирована БД); ответ на `login/request` всегда 204, чтобы не раскрывать наличие карточки. Отчёт по выпускникам агрегирует в БД, имена уволенных инструкторов дотягиваются через `IgnoreQueryFilters()` с явным `SchoolId == _db.SchoolId`. Список учеников инструктора и прогресс считаются фиксированным числом запросов без N+1 (ближайшее занятие — одним сгруппированным `Min(StartsAt)`), маскировка карточки переиспользует `MaskForInstructor()` из CSV-выгрузки.

Полный текст ответа также записан в `_answer.md`.