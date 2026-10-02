## Изменённые/созданные файлы

- `Models.cs` — у `ServiceRequest` добавлены `ContactPhone` (необязательный) и `ClosingComment` (заполняется при закрытии).
- `HousingDbContext.cs` — ограничения длины для новых колонок.
- `HousingService.cs` — сортировка реестра (`Sort`/`Dir` в `RequestSearch`, белый список колонок в `ORDER BY`, join'ы под адрес); `CloseRequestAsync` + `RequestNotInProgressException`; `ContactPhone` в создании заявки и в карточке.
- `PlanService.cs` — `ReplacePlanAsync(houseId, items)`: полная замена плана с сохранением истории по совпавшим `WorkCode`.
- `Endpoints.cs` (новый) — `POST /requests/{id}/close` и `PUT /houses/{id}/plan`.

## Решения

- Сортировка реализована через whitelist колонок в raw SQL, а не прямую подстановку `sort`/`dir`, чтобы не открыть SQL-инъекцию; join'ы на `apartments`/`houses` теперь добавляются и под сортировку по адресу, не только под фильтры.
- При удалении позиции плана использован явный `_db.PlanItems.Remove(...)`, а не только `Collection.Remove` — иначе при `DeleteOrphansTiming = Never` (уже настроено в `HousingDbContext`) запись не удалится.
- Миграцию EF для новых колонок не создавал: в репозитории нет каталога `Migrations`/csproj, а запускать `dotnet ef` было нельзя — нужно сгенерировать её отдельно перед релизом.

Тот же текст записан в `/home/mmx/.cache/research/runs/655f02/work/_answer.md`.