## Изменённые/созданные файлы

- `Services/NotificationChannels.cs` (новый) — константы ключей `Email`/`Sms` для keyed-сервисов.
- `Services/SmsSender.cs` (новый) — `INotificationSender`, пока пишет в лог.
- `Services/OrderService.cs` — теперь принимает `[FromKeyedServices(NotificationChannels.Sms)] INotificationSender`.
- `Controllers/OrdersController.cs` — параметр `email` переименован в `phone` (соответствует SMS-каналу).
- `Controllers/ReportsController.cs` (новый) — `POST /reports/{id}/send?email=...`, использует `[FromKeyedServices(NotificationChannels.Email)] INotificationSender`.
- `Program.cs` — `EmailSender`/`SmsSender` регистрируются через `AddKeyedSingleton` с ключами из `NotificationChannels`.

Оба канала остаются за `INotificationSender`, различаются только ключом keyed-сервиса; ключи вынесены в константы `NotificationChannels`, чтобы не дублировать строки-литералы в регистрации и в `[FromKeyedServices]`. `OrderService` переключён на SMS-канал (параметр переименован в `phone`), `ReportsController` — новый эндпоинт на email-канале.

Тот же текст сохранён в `_answer.md`.