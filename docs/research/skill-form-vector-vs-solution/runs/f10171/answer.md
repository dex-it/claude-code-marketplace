## Изменённые/созданные файлы

- `Services/SmsSender.cs` — новый `SmsSender : INotificationSender`, пишет в лог.
- `Services/NotificationChannels.cs` — константы ключей `Email`/`Sms` для keyed-сервисов.
- `Services/OrderService.cs` — резолвит отправителя через `[FromKeyedServices(NotificationChannels.Sms)]`, подтверждение заказа теперь уходит по SMS.
- `Controllers/ReportsController.cs` — новый, `POST /reports/{id}/send?email=...`, резолвит `[FromKeyedServices(NotificationChannels.Email)]` и отправляет отчёт.
- `Program.cs` — `EmailSender`/`SmsSender` зарегистрированы как `AddKeyedSingleton<INotificationSender, …>` под теми же константами.

## Решения

Оба отправителя stateless (только `ILogger`, без Scoped-зависимостей), поэтому оставлены `Singleton`. Ключи keyed-сервисов вынесены в константы `NotificationChannels`, чтобы избежать опечаток между регистрацией и `[FromKeyedServices]`. `OrderService` остаётся `Scoped`, зависимость от `Singleton`-отправителя captive dependency не создаёт.

Тот же текст записан в `_answer.md`.