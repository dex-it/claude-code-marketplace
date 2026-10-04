Готово! Реализовал все требования:

## Созданные/изменённые файлы:

1. **Models.cs** — добавлены поля `ContactPhone` и `CompletionComment` в `ServiceRequest`
2. **HousingService.cs** — сортировка реестра по `sort=date|address|status` и `dir=asc|desc`; метод `CloseRequestAsync` с валидацией статуса; контактный телефон в DTOs
3. **PlanService.cs** — метод `UpdatePlanAsync` для полной замены плана с сохранением истории
4. **HousingDbContext.cs** — конфигурация поля `ContactPhone`
5. **20261002_AddRequestFeaturesAndPlanUpdate.cs** — миграция БД
6. **RequestsController.cs** — `POST /requests/{id}/close` с обязательным комментарием
7. **HousesController.cs** — `PUT /houses/{id}/plan` для обновления плана

## Решения:
- Сортировка реестра: параметры `sort` и `dir` добавлены в `RequestSearch`, логика с условным `ORDER BY` в SQL
- Закрытие заявки: проверка `InProgress` перед переводом в `Done` (409 при ошибке), комментарий обязателен
- План дома: работы удаляются/добавляются/обновляются, история `PlanItemCompletion` сохраняется для оставшихся