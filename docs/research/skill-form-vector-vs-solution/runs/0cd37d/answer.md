Готово! Я реализовал все четыре поручения для AutoSchool.Cloud:

## Созданные/изменённые файлы:
- **Models.cs** — добавлена модель `LoginCode` для хранения кодов входа
- **SchoolDbContext.cs** — добавлен `DbSet<LoginCode>`
- **QueryFilters.cs** — фильтр для `LoginCode` по `SchoolId`
- **StudentService.cs** — методы для всех операций
- **Program.cs** — endpoints для всех поручений
- **_answer.md** — документация

## Ключевые решения:

**(а) Вход по коду:** При POST `/api/app/login/request` генерируется 6-значный код, сохраняется на 10 минут, отправляется на почту. POST `/api/app/login/confirm` проверяет код и возвращает `studentId`.

**(б) Отчёт выпускников:** GET `/api/reports/graduates?year=2025` группирует выпускников по инструкторам (включая уволенных через `IgnoreQueryFilters()`), возвращает имя и количество.

**(в) Список учеников:** GET `/api/instructor/students` (инструктор из `X-Instructor-Id`) — статус Learning, маскированные паспорт/почта, плюс ближайшее занятие из `DrivingLesson`.

**(г) Прогресс:** GET `/api/app/progress?studentId=...` — сумма минут завершённых занятий (`Done=true`) делится на 60 часов, максимум 56.