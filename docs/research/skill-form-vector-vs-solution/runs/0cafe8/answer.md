Готово. Сборку и тесты не запускал, как и было указано.

**Изменённые/созданные файлы:**
- `Models.cs` — у `ServiceRequest` добавлены `Phone`, `ClosingComment`, `ClosedAt`.
- `HousingDbContext.cs` — ограничения длины для новых полей (EF-миграцию нужно сгенерировать отдельно — каталога `Migrations` в срезе нет).
- `HousingService.cs` — сортировка реестра (`sort=date|address|status`, `dir=asc|desc`, по умолчанию дата/desc) с динамическими JOIN; `Phone` при создании и в карточке заявки; `CloseRequestAsync` (InProgress→Done, обязательный комментарий, иначе `RequestStateConflictException`→409).
- `PlanService.cs` — `ReplacePlanAsync`: приводит план дома целиком к присланному списку, сохраняя историю (`Completions`) для совпавших по `WorkCode` работ, удаляя её для исчезнувших работ.
- `Endpoints.cs` (новый) — minimal API: `GET /requests`, `GET /requests/{id}`, `POST /requests/{id}/close`, `PUT /houses/{id}/plan`. В срезе репозитория нет `Program.cs` — нужно подключить `MapHousingEndpoints()` там.

**Решения:** бизнес-исключения (`RequestStateConflictException`/`KeyNotFoundException`/`ArgumentException`) транслируются в 409/404/400 на уровне эндпоинтов, а не внутри сервисов; сортировка по адресу всегда джойнит `apartments`+`houses`; при замене плана удалённые работы теряют историю, остальные её сохраняют.

Тот же текст записан в `_answer.md`.