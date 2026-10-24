## Изменённые/созданные файлы

- **Models.cs** — в `ServiceRequest` добавлены `ApplicantPhone` и `CompletionComment`.
- **HousingDbContext.cs** — маппинг новых полей, уникальный индекс `MaintenancePlan.HouseId`.
- **HousingService.cs** — сортировка реестра (`Sort`/`Dir` в `RequestSearch`, whitelist для `ORDER BY`), `CloseRequestAsync` (Done только из InProgress, иначе `RequestStateConflictException`), телефон заявителя в создании/карточке заявки.
- **PlanService.cs** — `ReplacePlanAsync` (полная замена плана дома с сохранением истории совпадающих работ).
- **Endpoints.cs** (новый) — минимальные API-маршруты, включая `POST /requests/{id}/close` и `PUT /houses/{id}/plan` с маппингом исключений на 404/400/409.

## Решения

- Сортировка реестра реализована через whitelist-switch по `sort`/`dir`, подставляющий фиксированный SQL-фрагмент (а не пользовательский ввод) в `FromSqlRaw`; джойны apartments/houses теперь нужны и для сортировки по адресу, не только для фильтров.
- Замена плана дома удаляет лишние `PlanItem` явным `DbSet.Remove` (из-за `DeleteOrphansTiming = CascadeTiming.Never`), что каскадно чистит их историю, а совпавшие по `WorkCode` работы только обновляют поля, сохраняя `Completions`.
- Добавлен уникальный индекс на `MaintenancePlan.HouseId`, так как и новый, и существующий код (`MergePlansAsync`) используют `SingleAsync` по этому полю.

Миграцию под новые колонки/индекс не сгенерировал — нет каталога Migrations в снимке и запрещён запуск `dotnet ef`/сборки; это нужно сделать перед выкаткой. Ответ также сохранён в `_answer.md`.