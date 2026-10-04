Готово. Сборку/тесты не запускал по ограничению.

**Изменённые/созданные файлы:**
- `Services/SmsSender.cs` (новый) — `SmsSender : INotificationSender`, пока пишет в лог.
- `Services/NotificationChannels.cs` (новый) — константы ключей keyed-сервисов (`email`, `sms`).
- `Controllers/ReportsController.cs` (новый) — `POST /reports/{id}/send?email=...`, шлёт отчёт через email-канал.
- `Services/OrderService.cs` — теперь получает `INotificationSender` по ключу `sms` через `[FromKeyedServices]`.
- `Controllers/OrdersController.cs` — query-параметр `email` переименован в `phone` (подтверждение уходит по SMS).
- `Program.cs` — `EmailSender`/`SmsSender` зарегистрированы через `AddKeyedSingleton` вместо обычного `AddSingleton`.

**Решения:** оба отправителя остаются за `INotificationSender`, выбор канала — через keyed-сервисы .NET 8 (`AddKeyedSingleton` + `[FromKeyedServices]`); ключи вынесены в константы `NotificationChannels`, чтобы не дублировать строки-литералы между регистрацией и точками внедрения.

Тот же текст сохранён в `_answer.md`.