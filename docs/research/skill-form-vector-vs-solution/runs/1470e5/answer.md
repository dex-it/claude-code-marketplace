Созданные/изменённые файлы:
- **Services/SmsSender.cs** — новый, `INotificationSender`, пишет в лог.
- **Services/NotificationChannels.cs** — новый, константы ключей DI (`"email"`, `"sms"`).
- **Controllers/ReportsController.cs** — новый, `POST /reports/{id}/send?email=...`, отправляет отчёт через email-канал.
- **Services/OrderService.cs** — теперь принимает `[FromKeyedServices(NotificationChannels.Sms)] INotificationSender`, подтверждение уходит по SMS.
- **Controllers/OrdersController.cs** — параметр `email` → `phone` (соответствует новому каналу SMS).
- **Program.cs** — вместо одной обычной регистрации `INotificationSender` — два `AddKeyedSingleton` (email/sms).

Решения: оба отправителя остаются за интерфейсом `INotificationSender`, выбор канала делается через keyed DI .NET 8 (`AddKeyedSingleton` + `[FromKeyedServices]`) без ветвления по типу; ответ также записан в `_answer.md`. Сборка/тесты не запускались согласно ограничению.