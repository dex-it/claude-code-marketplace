## Созданные/изменённые файлы

- `Models.cs` — изменён: добавлена сущность `LoginCode` (ISchoolOwned) для одноразовых кодов входа.
- `SchoolDbContext.cs` — изменён: `DbSet<LoginCode>`, индекс `(StudentId, Code)`, связь со `Student`.
- `QueryFilters.cs` — изменён: query-фильтр по `SchoolId` для `LoginCode`.
- `StudentService.cs` — изменён: добавлены `GetAssignedStudentsAsync` (п. в) и `GetProgressAsync` (п. г) + DTO `InstructorStudentDto`, `ProgressDto`.
- `AppAuthService.cs` — новый: `RequestLoginAsync`/`ConfirmLoginAsync` для входа ученика по коду (п. а).
- `ReportsService.cs` — новый: `GraduatesByInstructorAsync` — отчёт по выпускникам (п. б).
- `Program.cs` — изменён: регистрация новых сервисов в DI и 5 эндпоинтов: `POST /api/app/login/request`, `POST /api/app/login/confirm`, `GET /api/app/progress`, `GET /api/reports/graduates`, `GET /api/instructor/students`.

## Решения

- **(а)** E-mail сравнивается через `ToLower()` с обеих сторон (регистр не важен). Код — 6 цифр через криптостойкий `RandomNumberGenerator`, живёт 10 минут, старые неиспользованные коды гасятся при повторном запросе. Ответ на `request` всегда `200 Ok`, даже если e-mail не найден — чтобы не раскрывать существование карточки.
- **(б)** Отчёт берёт `GraduatedOn` в пределах года, имена инструкторов (включая уволенных) — через `IgnoreQueryFilters()` с ручной проверкой `SchoolId`.
- **(в)** Список учеников инструктора получен через `AsNoTracking()` — иначе `MaskForInstructor()` замаскировал бы email/паспорт у отслеживаемых сущностей, и `SaveChangesFilter` записал бы маску обратно в БД (эта ловушка уже скрыто обходилась в существующем CSV-экспорте вне `/api`-группы). Ближайшее занятие — один `GROUP BY` по будущим урокам без N+1.
- **(г)** Прогресс = сумма `Minutes` по урокам с `Done = true` в часах; норматив 56 вынесен в константу.

Ответ также сохранён в `_answer.md`.