## Изменённые/созданные файлы

- **`Models.cs`** — в `ServiceRequest` добавлены `ContactPhone` и `CompletionComment`.
- **`HousingDbContext.cs`** — маппинг `ContactPhone`. Миграцию под новые колонки не генерировал — это требует сборки проекта (`dotnet ef migrations add`), что запрещено условиями; добавьте её отдельно перед деплоем.
- **`HousingService.cs`** — сортировка реестра (`Sort`/`Dir` → whitelist `ORDER BY`: date/address/status, статус по порядку бизнес-процесса через `CASE`, не по алфавиту); `CloseRequestAsync` (комментарий обязателен, закрытие только из `InProgress`, иначе `RequestNotInProgressException`); `RequestCard`/`NewRequest` дополнены телефоном/комментарием.
- **`PlanService.cs`** — `ReplacePlanAsync`: план дома приводится целиком к переданному списку, совпавшие по `WorkCode` работы обновляются с сохранением истории `Completions`, лишние — удаляются явным `Remove` (из-за `DeleteOrphansTiming = Never` в контексте), новые — добавляются.
- **`Endpoints.cs`** (новый) — `POST /requests/{id}/close` и `PUT /houses/{id}/plan` с маппингом исключений в 400/404/409.
- **`_answer.md`** (новый) — этот же ответ.

## Решения

Сортировка собирается только из фиксированных SQL-литералов по whitelist (не из значений `sort`/`dir` напрямую) — это требование правила про динамический `FromSqlRaw`. Удаление позиций плана при замене — явный `_db.PlanItems.Remove`, а не отвязка от коллекции, поскольку в контексте отключено автоматическое удаление "осиротевших" зависимых записей (используется для переноса работ между планами домов).