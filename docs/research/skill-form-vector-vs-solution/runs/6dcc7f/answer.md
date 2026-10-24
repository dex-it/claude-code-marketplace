## Изменённые/созданные файлы

- `Models.cs` — у `ServiceRequest` добавлены `ContactPhone` (необяз.) и `ClosingComment` (необяз.).
- `HousingDbContext.cs` — маппинг новых полей.
- `HousingService.cs` — сортировка реестра (`RequestSort`/`SortDirection`, whitelist в `ORDER BY`), `CloseRequestAsync` (только из `InProgress`), телефон в `NewRequest`/`RequestCard`, комментарий в `RequestCard`.
- `PlanService.cs` — `ReplacePlanAsync` (замена плана целиком с сохранением истории совпавших работ).
- `Controllers/RequestsController.cs` (новый) — `GET /requests`, `GET/POST /requests/{id}`, `POST /requests/{id}/close`.
- `Controllers/HousesController.cs` (новый) — `GET/PUT /houses/{id}/plan`.

## Решения

Сортировка реестра реализована через whitelist столбцов/направления в `FromSqlRaw` (не через пользовательский текст), с доджойном `houses`/`apartments` для адреса. Закрытие заявки и замена плана не используют исключения для ожидаемых бизнес-условий — enum-результат из сервиса/валидация в контроллере дают 409/400/404. Удаление работ из плана сделано явным (`_db.PlanItems.RemoveRange`), т.к. `DeleteOrphansTiming=Never` в проекте специально отключает авто-каскад (нужен для `MergePlansAsync`).

**Важно:** новые поля `ServiceRequest` требуют EF-миграции (`dotnet ef migrations add`) перед деплоем через `efbundle` — не выполнял, так как сборка/миграции были под запретом в этой сессии.

Тот же текст записан в `/home/mmx/.cache/research/runs/6dcc7f/work/_answer.md`.