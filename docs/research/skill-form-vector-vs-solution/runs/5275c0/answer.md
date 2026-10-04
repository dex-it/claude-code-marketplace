## Изменённые/созданные файлы

- `Models.cs` — у `ServiceRequest` добавлены поля `ContactPhone` и `ClosingComment`.
- `HousingDbContext.cs` — ограничение длины для `ContactPhone`.
- `HousingService.cs` — сортировка реестра (`Sort`/`Dir` в `RequestSearch`, безопасный `BuildOrderBy`, всегда-джойн домов/квартир), `CloseRequestAsync` (409 через `RequestNotInProgressException`), телефон/комментарий в `NewRequest`/`RequestCard`.
- `PlanService.cs` — `ReplacePlanAsync` (полная замена плана с сохранением истории по совпадающим `WorkCode`).
- `Endpoints.cs` (новый) — HTTP-слой: `GET /requests`, `GET /requests/{id}`, `POST /requests`, `POST /requests/{id}/close`, `PUT /houses/{id}/plan` (в данном срезе репозитория не было ни одного эндпоинта/`Program.cs`, так что это новый слой, который нужно подключить вызовом `app.MapHousingEndpoints()`).

## Решения

Сортировка реестра валидируется в query-параметрах и маппится на enum, а в SQL подставляется только литерал из белого списка — инъекция через `sort`/`dir` исключена. Замена плана (в) сделана как "diff по WorkCode" прямо через EF-граф, по аналогии с уже существующим `MergePlansAsync`. Миграцию для новых колонок (`contact_phone`, `closing_comment`) не генерировал — `dotnet ef migrations add` не запускал, так как сборка запрещена; это нужно сделать перед деплоем через `efbundle`.

Тот же текст записан в `_answer.md`.