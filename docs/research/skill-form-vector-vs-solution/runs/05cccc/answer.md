Готово. Сборку и тесты не запускал, как просили.

**Созданные/изменённые файлы:**
- `Models.cs` — сущность `LoginCode`
- `SchoolDbContext.cs` — `DbSet<LoginCode>` + конфигурация
- `QueryFilters.cs` — фильтр `LoginCode` по школе
- `AppService.cs` (новый) — вход по коду (а) и прогресс ученика (г)
- `InstructorService.cs` (новый) — список учеников инструктора (в)
- `ReportService.cs` (новый) — отчёт по выпускникам (б)
- `Program.cs` — DI и endpoints: `POST /api/app/login/request`, `POST /api/app/login/confirm`, `GET /api/app/progress`, `GET /api/reports/graduates`, `GET /api/instructor/students`

**Решения:** e-mail при входе сравнивается без учёта регистра, код хранится в БД с TTL 10 мин и инвалидацией старых кодов, сравнение — `FixedTimeEquals`, ответ на запрос кода не раскрывает факт регистрации почты. В отчёте по выпускникам инструкторы читаются через `IgnoreQueryFilters()` + ручной фильтр по школе, чтобы учесть уволенных, но не утечь в другую автошколу. Список учеников инструктора переиспользует `Student.MaskForInstructor()` из существующего `StudentService`.

Тот же текст записан в `_answer.md`.