## Изменённые/созданные файлы

- `Models.cs` — добавлена сущность `LoginCode` (код для входа: хэш кода, срок действия, флаг использования).
- `SchoolDbContext.cs` — добавлен `DbSet<LoginCode>` и его конфигурация.
- `QueryFilters.cs` — добавлен глобальный фильтр по `SchoolId` для `LoginCode`.
- `AppLoginService.cs` (новый) — запрос и проверка одноразового кода (а).
- `ReportService.cs` (новый) — отчёт по выпускникам за год по инструкторам (б).
- `InstructorAppService.cs` (новый) — список закреплённых учеников инструктора с ближайшим занятием (в).
- `StudentService.cs` — добавлен метод `GetProgressAsync` (часы вождения из 56) (г).
- `Program.cs` — регистрация новых сервисов и эндпоинты: `POST /api/app/login/request`, `POST /api/app/login/confirm`, `GET /api/app/progress`, `GET /api/reports/graduates`, `GET /api/instructor/students`.

## Решения

E-mail сравнивается через `.ToLower()`, чтобы регистр с телефонной клавиатуры не мешал; код хранится как SHA-256 хэш с TTL 10 минут, а при отсутствии ученика сервис молчит (не выдаёт факт существования e-mail). Отчёт по выпускникам берёт инструкторов через `IgnoreQueryFilters()`, чтобы не терять уволенных. Список учеников инструктора и прогресс переиспользуют существующую маску `MaskForInstructor()` и поля `Lessons.Done`/`Minutes`.

Ответ также записан в `_answer.md`.