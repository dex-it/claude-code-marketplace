**Созданные файлы:**
- `Services/SmsSender.cs` — реализация `INotificationSender`, логирует отправку SMS.
- `Services/NotificationChannels.cs` — константы ключей keyed-сервисов (`email`, `sms`).
- `Controllers/ReportsController.cs` — `POST /reports/{id}/send?email=...`.

**Изменённые файлы:**
- `Program.cs` — оба отправителя зарегистрированы как `AddKeyedSingleton<INotificationSender, ...>` по ключам `NotificationChannels.Email/Sms`.
- `Services/OrderService.cs` — получает `[FromKeyedServices(NotificationChannels.Sms)]` отправителя; подтверждение теперь идёт по SMS.
- `Controllers/OrdersController.cs` — параметр запроса переименован `email` → `phone` (теперь это номер телефона).

Оба канала остаются за интерфейсом `INotificationSender`, выбор реализации — через keyed DI .NET 8, ключи вынесены в константы, чтобы избежать опечаток в строковых ключах. Ответ также записан в `_answer.md`.