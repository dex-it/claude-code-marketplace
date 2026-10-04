## Созданные/изменённые файлы

- `Services/SmsSender.cs` — новый, `SmsSender : INotificationSender`, пишет в лог.
- `Controllers/ReportsController.cs` — новый, `POST /reports/{id}/send?email=...`, отправляет отчёт по email.
- `Services/OrderService.cs` — изменён, теперь берёт `INotificationSender` через keyed-сервис `"sms"`; параметр переименован в `customerPhone`.
- `Controllers/OrdersController.cs` — изменён, query-параметр `email` → `phone` (подтверждение теперь уходит по SMS).
- `Program.cs` — изменён, `EmailSender` и `SmsSender` зарегистрированы как `AddKeyedSingleton<INotificationSender, ...>` с ключами `"email"` и `"sms"`.

## Решения

Оба отправителя остались за общим `INotificationSender`, выбор канала — через keyed DI (`AddKeyedSingleton` + `[FromKeyedServices("key")]`), без Service Locator. `OrderService` жёстко привязан к ключу `"sms"`, `ReportsController` — к `"email"`. Параметр в `OrdersController.Confirm` переименован в `phone`, так как отправка теперь по SMS.

Ответ также записан в `_answer.md`.