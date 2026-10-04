Созданные файлы:
- Services/SmsSender.cs — SmsSender : INotificationSender, пишет в лог ("sms to {Recipient}").
- Services/ReportService.cs — сервис для ReportsController, шлёт отчёт через keyed email-отправителя.
- Services/NotificationChannels.cs — константы ключей keyed-сервисов (Email, Sms).
- Controllers/ReportsController.cs — POST /reports/{id}/send?email=... -> ReportService.SendAsync -> 204.

Изменённые файлы:
- Program.cs — EmailSender и SmsSender регистрируются как AddKeyedSingleton<INotificationSender,...> по константам из NotificationChannels; добавлен AddScoped<ReportService>.
- Services/OrderService.cs — принимает [FromKeyedServices(NotificationChannels.Sms)] INotificationSender; подтверждение заказа теперь уходит по SMS (параметр переименован в customerPhone).
- Controllers/OrdersController.cs — query-параметр Confirm переименован email -> phone (соответствует новому SMS-каналу подтверждения).

Решения:
- Оба канала остаются за единым INotificationSender; выбор конкретной реализации — через keyed DI (.NET 8), ключ — одна константа (NotificationChannels), используемая и в регистрации, и во всех [FromKeyedServices], как требует SKILL.md.
- Бизнес-логика отправки отчёта вынесена в ReportService (не в контроллер), сигнатура и стиль ReportsController зеркалят уже существующий OrdersController (path-id + query-параметр, 204 No Content) для консистентности схемы URL.
- SmsSender сделан по образцу EmailSender (тот же контракт, только логирование) — задел на реальную интеграцию с SMS-провайдером в будущем.
