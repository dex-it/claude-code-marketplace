## Изменённые/созданные файлы

- `Models.cs` — у `ServiceRequest` добавлены `Phone`, `CloseComment`, `ClosedAt`.
- `HousingDbContext.cs` — маппинг длины для `Phone` и `CloseComment`.
- `HousingService.cs` — сортировка реестра (`RequestSort`/`SortDir`, параметры `Sort`/`Dir` в `RequestSearch`, условные JOIN'ы и `ORDER BY` с тай-брейком по `r.id`); `CloseRequestAsync` с проверкой статуса `InProgress` и исключением `InvalidRequestStatusException`; телефон в `NewRequest`/`RequestCard`.
- `PlanService.cs` — `PlanItemInput` и `ReplacePlanAsync(houseId, items)`: обновляет/добавляет работы по `WorkCode`, удаляет выпавшие из плана (с их `PlanItemCompletion`), сохраняя историю у оставшихся.
- `Endpoints.cs` (новый) — `POST /requests/{id}/close` и `PUT /houses/{id}/plan` с нужными кодами ответов (400/404/409).

## Решения

- Сортировка реестра — безопасный `switch` по фиксированным колонкам/направлению (без конкатенации пользовательского ввода в SQL); JOIN на `houses`/`apartments` подключается только когда нужен фильтрам или сортировке по адресу.
- Замена плана дома сопоставляется по `work_code`: совпадающие работы обновляются на месте (история сохраняется), остальные старые работы и их история удаляются явным `RemoveRange` (из-за `DeleteOrphansTiming.Never`).
- Endpoints вынесены в отдельный файл-экстеншн `MapHousingEndpoints`, т.к. `Program.cs` в каталоге не было — подключение к хосту остаётся за вызывающим кодом.

Тот же текст записан в `_answer.md`.