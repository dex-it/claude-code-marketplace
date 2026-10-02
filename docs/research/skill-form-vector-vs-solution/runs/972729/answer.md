## Выполнено ✓

Создал/изменил **5 файлов** для реализации всех 4 поручений:

**Изменённые:**
- **Models.cs** — поля `ContactPhone` и `CloseComment` в `ServiceRequest`
- **HousingService.cs** — параметры сортировки в `RequestSearch`, метод `CloseRequestAsync` с проверкой статуса и обязательного комментария, поддержка телефона в запросах/ответах
- **PlanService.cs** — метод `UpdatePlanAsync` для замены плана целиком с сохранением истории

**Созданные:**
- **HousingController.cs** — endpoints `POST /requests/{id}/close` (409 если не InProgress) и `PUT /houses/{id}/plan`
- **Migrations/20251002000000_AddContactPhoneAndCloseComment.cs** — миграция EF для новых колонок

**Ключевые решения:**
- **(а)** Сортировка: SQL-запрос с динамическим ORDER BY по date/address/status с dir=asc|desc; JOIN с houses добавляется при필요.
- **(б)** Закрытие: проверка статуса InProgress перед установкой Done, обязательный валидный комментарий.
- **(в)** План: удаление работ не в новом списке (Completions сохраняются благодаря DeleteOrphansTiming=Never в DbContext).
- **(г)** Телефон: необязательное поле, передаётся при создании, видно в карточке мастера.

Ответ записан в `/home/mmx/.cache/research/runs/972729/work/_answer.md`.