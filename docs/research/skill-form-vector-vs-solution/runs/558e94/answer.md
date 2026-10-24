## Выполнено ✓

**Изменённые файлы:**
- `Models.cs` - добавлены `PhoneNumber` и `CompletionComment` в `ServiceRequest`
- `HousingService.cs` - сортировка реестра (sort=date|address|status, dir=asc|desc), метод `CloseRequestAsync`, поддержка телефона
- `PlanService.cs` - метод `UpdatePlanAsync` для замены плана целиком
- `HousingDbContext.cs` - конфигурация для новых полей
- `_answer.md` - описание решений

**Решения:**
- **(а)** Сортировка через параметры `Sort` и `Dir` в `SearchAsync` - по умолчанию date DESC (новые сверху); адрес сортируется по house_id и apartment_number для группировки
- **(б)** `CloseRequestAsync` проверяет статус InProgress, устанавливает Done с обязательным комментарием; контроллер должен вернуть 409 при других статусах
- **(в)** `UpdatePlanAsync` удаляет/добавляет/обновляет работы в плане, история выполнения сохраняется через FK-связь (Completions удаляются только вместе с работой)
- **(г)** `PhoneNumber?` в ServiceRequest, передаётся при создании, видно в карточке заявки