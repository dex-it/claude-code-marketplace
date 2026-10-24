## Изменённые файлы
- `Models.cs` — добавлена сущность `LoginCode` (хэш одноразового кода, срок действия, флаг использования).
- `SchoolDbContext.cs` — добавлен `DbSet<LoginCode>` и его конфигурация.
- `QueryFilters.cs` — глобальный фильтр по `SchoolId` для `LoginCode`.
- `Program.cs` — регистрация сервисов + 5 endpoint'ов в группе `/api`.

## Новые файлы
- `AppAuthService.cs` — (а) `POST /api/app/login/request` и `/confirm`.
- `ReportService.cs` — (б) `GET /api/reports/graduates?year=`.
- `InstructorAppService.cs` — (в) `GET /api/instructor/students`.
- `StudentProgressService.cs` — (г) `GET /api/app/progress?studentId=`.

Ключевые решения: email сравнивается без учёта регистра, код хранится только как SHA-256-хэш с TTL 10 мин; отчёт по выпускникам обходит фильтр `!IsDeleted` у инструкторов через `IgnoreQueryFilters()` (с ручным условием по школе), чтобы учесть уволенных; список учеников инструктора читается с `AsNoTracking()`, иначе маскирование паспорта/почты в памяти записалось бы в БД через `SaveChangesFilter`. Миграция для `LoginCode` не сгенерирована — сборка/CLI не запускались по условиям задачи, это отмечено в `_answer.md`.