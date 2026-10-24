## Созданные/изменённые файлы

- `Models.cs` — поля `ContactPhone` (опц.) и `ClosingComment` в `ServiceRequest`.
- `HousingDbContext.cs` — маппинг `ContactPhone`.
- `HousingService.cs` — сортировка реестра (`RequestSort`/`SortDir`, join'ы по требованию, безопасный `ORDER BY`), `ContactPhone` в создании/карточке заявки, `CloseRequestAsync` (409 через `RequestNotInProgressException`).
- `PlanService.cs` — `PlanItemInput` и `ReplacePlanAsync` (замена плана целиком с сохранением истории совпавших работ).
- `Endpoints.cs` (новый) — минимальные API-маршруты, включая `POST /requests/{id}/close` и `PUT /houses/{id}/plan`.

## Решения

Сортировка строится из закрытого enum (не из сырой строки), что исключает SQL-инъекцию и позволяет добавлять нужные JOIN'ы только когда они реально требуются. Замена плана реализована через diff по `WorkCode`: совпавшие пункты сохраняют `Id`/историю, остальные удаляются вместе с `Completions`, новые добавляются пустыми. В репозитории не было HTTP-слоя (`Program.cs`/контроллеров), поэтому для требуемых эндпоинтов добавлен отдельный `Endpoints.cs`; миграция для новых колонок не создавалась (нет папки `Migrations` в этом срезе и нельзя запускать команды) — это зафиксировано как следующий шаг.

Ответ также записан в `_answer.md`.