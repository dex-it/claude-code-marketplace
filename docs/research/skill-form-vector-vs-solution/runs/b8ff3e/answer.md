**Готово.** Выполнены все четыре поручения:

## Изменённые файлы

- **Models.cs** — добавлены `PhoneNumber` и `CompletionComment` в `ServiceRequest`
- **HousingService.cs** — сортировка реестра (date/address/status, asc/desc), метод `CloseRequestAsync`, обновлены records для телефона
- **PlanService.cs** — метод `UpdatePlanAsync` для замены плана с сохранением истории

## Решения

(а) Сортировка встроена в SQL: параметры Sort и Dir в RequestSearch, динамический ORDER BY по дате (новые сверху по умолчанию), адресу (дом→квартира) или статусу.

(б) `CloseRequestAsync` требует статус InProgress, устанавливает Done и обязательный `CompletionComment`; контроллер ловит `InvalidOperationException` → 409 Conflict.

(в) `UpdatePlanAsync` различает работы по WorkCode, удаляет отсутствующие, обновляет существующие, создаёт новые; история в Completions сохраняется автоматически.

(г) Поле `PhoneNumber` необязательное, передаётся при создании заявки, видно мастеру в карточке.