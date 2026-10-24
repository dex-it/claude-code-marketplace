Готово. Изменённые/созданные файлы:

- **Models.cs** — `ServiceRequest`: добавлены `ContactPhone`, `ClosingComment`, `ClosedAt` (nullable).
- **HousingDbContext.cs** — `HasMaxLength` для новых колонок.
- **HousingService.cs** — `RequestSort`/`SortDirection`, сортировка в `SearchAsync`; телефон в `NewRequest`/`RequestCard`; метод `CloseRequestAsync`.
- **PlanService.cs** — метод `ReplacePlanAsync` (полная замена плана дома с сохранением истории).
- **Endpoints.cs** (новый) — `GET /requests` (sort/dir), `POST /requests/{id}/close`, `PUT /houses/{id}/plan`.

Ключевые решения:
- Закрытие заявки — атомарный `ExecuteUpdateAsync(... WHERE status=InProgress)`, чтобы гонка при параллельном закрытии не терялась молча, а давала 409/404.
- Замена плана — элементы с совпавшим `WorkCode` обновляются in-place (история сохраняется), остальные удаляются явным `Remove` (каскадно чистит их историю), что не конфликтует с существующим `DeleteOrphansTiming.Never`.
- Сортировка реестра — JOIN на `apartments/houses` добавляется и для сортировки по адресу (не только по фильтрам), колонка/направление — из enum, а не из строки клиента, в `FromSqlRaw`.

Не было папки `Migrations`/`Program.cs` в каталоге, поэтому миграцию под новые колонки вручную не писал — команде нужно прогнать `dotnet ef migrations add`, так как запуск тулинга был запрещён. Тот же текст записан в `_answer.md`.