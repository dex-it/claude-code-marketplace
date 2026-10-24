## Созданные файлы
- `Services/SmsSender.cs` — `SmsSender : INotificationSender`, пишет в лог.
- `Services/NotificationChannel.cs` — константы ключей ("email", "sms") для keyed-сервисов.
- `Services/ReportService.cs` — отправка отчёта по email через keyed `INotificationSender`.
- `Controllers/ReportsController.cs` — `POST /reports/{id}/send?email=...`.

## Изменённые файлы
- `Program.cs` — регистрация `EmailSender`/`SmsSender` как `AddKeyedSingleton<INotificationSender>`, добавлен `ReportService`.
- `Services/OrderService.cs` — теперь внедряется SMS-канал через `[FromKeyedServices(NotificationChannel.Sms)]`.
- `Controllers/OrdersController.cs` — параметр запроса переименован `email` → `phone`.

## Решения
Оба отправителя остаются за `INotificationSender`, выбор канала делается через .NET 8 keyed DI (`AddKeyedSingleton` + `[FromKeyedServices]`) без флагов и веток if/else. `OrderService` жёстко привязан к SMS-ключу, `ReportService` — к email-ключу, согласно условию задачи.

Ответ также записан в `_answer.md`. Сборку и тесты не запускал, как и было указано.