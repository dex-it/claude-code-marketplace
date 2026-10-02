Изменённые/созданные файлы:
- **Models.cs** — у `ServiceRequest` добавлены `ContactPhone` и `ClosingComment`.
- **HousingDbContext.cs** — maxlength для новых колонок.
- **HousingService.cs** — сортировка реестра (`Sort`/`Dir` → whitelist date|address|status, asc|desc), поле `contact_phone`/`closing_comment` в `FromSqlRaw`, `CloseRequestAsync` с проверкой статуса `InProgress` и обязательным комментарием.
- **PlanService.cs** — `ReplacePlanAsync` приводит план дома к присланному списку работ, сохраняя историю по совпадающим `WorkCode`.
- **Endpoints.cs** (новый) — `POST /requests/{id}/close` и `PUT /houses/{id}/plan`.

Решения: сортировка реестра — только через whitelist-маппинг в SQL-фрагменты (без интерполяции пользовательской строки) плюс `r.id` как тай-брейкер для стабильной пагинации; замена плана удаляет лишние работы явным `_db.PlanItems.Remove` (не через `Items.Remove`), поскольку контекст уже настроен `DeleteOrphansTiming=Never` под перенос работ между планами и сам не удалит "осиротевшую" запись — удаление каскадно подчищает историю по FK. Миграцию под новые колонки `contact_phone`/`closing_comment` не генерировал (нужен `dotnet ef migrations add`, сборка запрещена условиями задачи) — это отмечено в ответе как следующий шаг. Тот же текст сохранён в `_answer.md`.