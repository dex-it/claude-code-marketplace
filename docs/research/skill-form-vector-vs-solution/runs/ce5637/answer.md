## Изменённые/созданные файлы

- `Services/NotificationChannels.cs` (новый) — константы ключей `Email`/`Sms`
- `Services/SmsSender.cs` (новый) — `SmsSender : INotificationSender`, пишет в лог
- `Services/OrderService.cs` — теперь зависит от `[FromKeyedServices("sms")] INotificationSender`
- `Controllers/OrdersController.cs` — параметр `email` переименован в `phone`
- `Controllers/ReportsController.cs` (новый) — `POST /reports/{id}/send?email=...`, использует `[FromKeyedServices("email")] INotificationSender`
- `Program.cs` — оба отправителя зарегистрированы через `AddKeyedSingleton<INotificationSender, ...>`

## Решения

Оба канала остаются за `INotificationSender`, разграничение — через keyed DI .NET 8 (`AddKeyedSingleton`/`[FromKeyedServices]`), ключи вынесены в константы `NotificationChannels`, чтобы исключить опечатки. `OrderService` привязан к SMS, `ReportsController` — к email; переименовал `email`→`phone` в подтверждении заказа, так как оно физически теперь уходит по SMS. Тот же текст сохранён в `_answer.md`.