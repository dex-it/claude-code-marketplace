## Завершено ✓

**Файлы изменены:**
- `Models.cs` — добавлены `PhoneNumber` и `CompletionNote` в `ServiceRequest`
- `HousingService.cs` — сортировка реестра (date|address|status с asc/desc), метод `CloseRequestAsync`, поддержка телефона
- `PlanService.cs` — метод `UpdatePlanAsync` для замены плана с сохранением истории
- `HousingDbContext.cs` — конфигурация `PhoneNumber`

**Решения:** Сортировка собирается динамически в SQL с JOIN'ами при необходимости; закрытие проверяет статус InProgress и требует комментарий; план обновляется через удаление отсутствующих и обновление/добавление новых работ, история сохраняется благодаря `CascadeTiming.Never`.