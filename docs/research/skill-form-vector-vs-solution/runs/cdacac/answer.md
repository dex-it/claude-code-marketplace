Выполнил все четыре пункта. Изменённые/созданные файлы:

- **Models.cs** — у `ServiceRequest` добавлены `ContactPhone` (необязательный), `CloseComment`, `ClosedAt`.
- **HousingDbContext.cs** — ограничения длины для новых колонок.
- **HousingService.cs** — `RequestSearch` получил `Sort`/`Dir`; `SearchAsync` строит `ORDER BY` по фиксированному enum (date по умолчанию, новые сверху; address — дом+квартира; status); `CreateRequestAsync`/`GetRequestAsync` работают с телефоном и данными закрытия; добавлен `CloseRequestAsync` (комментарий обязателен, закрытие только из `InProgress`, иначе `RequestStateConflictException`).
- **PlanService.cs** — добавлен `ReplacePlanAsync`: план дома приводится к присланному списку по `WorkCode`, совпавшие работы сохраняют историю, убранные удаляются вместе с историей, новые добавляются без неё.
- **Exceptions.cs** (новый) — `RequestStateConflictException` для 409.
- **Endpoints.cs** (новый) — маршруты `GET /requests` (с валидацией `sort`/`dir`), `GET /requests/{id}`, `POST /requests`, `POST /requests/{id}/close`, `PUT /houses/{id}/plan`.

Решения: сортировка собирается из фиксированного enum (без риска SQL-инъекции в ORDER BY) с тай-брейком по `r.id`; diff плана ведётся по `WorkCode`, completions удалённых работ удаляются явно, не полагаясь на БД-каскад. Миграцию EF Core под новые колонки не создавал — это требует `dotnet ef migrations add`/сборки, что запрещено условиями. Тот же текст записан в `_answer.md`.