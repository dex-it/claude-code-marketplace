## Изменённые/созданные файлы

- **Models.cs** — у `ServiceRequest` добавлены `ContactPhone`, `CompletionComment`, `ClosedAt`.
- **HousingDbContext.cs** — максимальные длины для новых строковых полей.
- **HousingService.cs** — `RequestSearch` получил `Sort`/`Dir` (enum `RequestSortField`/`SortDirection`), `SearchAsync` строит JOIN/ORDER BY по ним (date/address/status); `RequestCard`/`NewRequest` дополнены `ContactPhone`; добавлены `CloseRequestAsync` и `RequestConflictException` (409).
- **PlanService.cs** — `PlanItemInput` и `ReplacePlanAsync`: план дома приводится к присланному списку, у совпадающих по `WorkCode` работ история (`Completions`) не трогается, у удалённых — удаляется явно, новые добавляются.
- **Endpoints.cs** (новый) — минимальные API: `GET /requests` (с sort/dir), `GET/POST /requests`, `POST /requests/{id}/close`, `GET/PUT /houses/{id}/plan`; нужно вызвать `app.MapHousingEndpoints()` из `Program.cs` (его в этом срезе проекта нет).

## Решения

Сортировка реестра встроена прямо в существующий `FromSqlRaw`-запрос: JOIN на apartments/houses навешивается и под `sort=address`; статус сортируется по `CASE`-рангу жизненного цикла, а не по алфавиту. `sort`/`dir` валидируются на уровне эндпоинта (400 при мусоре), в SQL попадают только фиксированные enum-строки. Закрытие заявки и замена плана проверяют состояние на уровне сервиса (`KeyNotFoundException`→404, `RequestConflictException`→409, `ArgumentException`→400). `ContactPhone` необязателен и виден только в карточке заявки, не в реестре.

Ответ также записан в `_answer.md`. Миграцию EF для новых колонок (`contact_phone`, `completion_comment`, `closed_at`) нужно сгенерировать отдельно через `dotnet ef migrations add` — я не запускал сборку/EF-инструменты по ограничению задачи.