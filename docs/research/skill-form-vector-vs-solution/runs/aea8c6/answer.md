Готово. Изменённые/созданные файлы:

- **Models.cs** — у `ServiceRequest` добавлены `ContactPhone`, `ClosingComment`, `ClosedAt`.
- **HousingDbContext.cs** — `HasMaxLength` для новых колонок.
- **HousingService.cs** — сортировка реестра (`Sort`/`Dir` с безопасным whitelist-маппингом в `ORDER BY`, доп. join'ы по необходимости), контактный телефон в `NewRequest`/`RequestCard`, `CloseRequestAsync` (атомарный `ExecuteUpdateAsync` по условию `Status==InProgress`, 404/409 через исключения).
- **PlanService.cs** — `ReplacePlanAsync`: обновляет совпавшие по `WorkCode` работы на месте (история сохраняется), добавляет новые, явно удаляет (`_db.PlanItems.Remove`) пропавшие — без explicit-Remove разрыв required-связи при `DeleteOrphansTiming=Never` бросил бы исключение.
- **Endpoints.cs** (новый) — `POST /requests/{id}/close` и `PUT /houses/{id}/plan`.

Ключевые решения: закрытие заявки через один атомарный `UPDATE ... WHERE status='InProgress'` исключает гонку между мастерами; сортировка собирается из фиксированных литералов (без инъекции через query-параметры); миграцию под новые колонки не создавал — `dotnet ef migrations add` не запускал (ограничение задачи), а каталога `Migrations` в репозитории для сверки стиля не было. Полный текст ответа также записан в `_answer.md`.