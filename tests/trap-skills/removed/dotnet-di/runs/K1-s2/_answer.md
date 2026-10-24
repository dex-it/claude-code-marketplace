Созданные файлы:
- Services/SmsSender.cs — второй канал уведомлений, INotificationSender, пока пишет в лог (`_log.LogInformation("sms to {Recipient}", ...)`).
- Services/NotificationSenderKeys.cs — константы ключей keyed-сервисов (Email/Sms), одна константа на регистрацию и на все `[FromKeyedServices]`.
- Services/ReportService.cs — тонкий сервис-обвязка для отчётов, инжектит email-канал через `[FromKeyedServices(NotificationSenderKeys.Email)]`.
- Controllers/ReportsController.cs — POST /reports/{id:guid}/send?email=..., маршрутизирует в ReportService, без бизнес-логики в контроллере.

Изменённые файлы:
- Program.cs — EmailSender и SmsSender зарегистрированы как `AddKeyedSingleton<INotificationSender, ...>` под ключами Email/Sms; добавлен `AddScoped<ReportService>()`.
- Services/OrderService.cs — теперь получает keyed SMS-отправитель (`[FromKeyedServices(NotificationSenderKeys.Sms)]`), подтверждение заказа уходит по SMS.
- Controllers/OrdersController.cs — query-параметр переименован `email` -> `phone` (семантика изменилась: OrderService шлёт SMS, оставлять имя `email` было бы вводящим в заблуждение контрактом).

Решения:
- Оба канала остаются за INotificationSender; выбор канала — через .NET 8 keyed services, ключ — общая константа (NotificationSenderKeys), а не строковый литерал в местах регистрации/инъекции — по правилу из SKILL.md.
- ReportsController не содержит логики отправки — только маршрутизация в ReportService, который берёт keyed email-сендер; это тот же тонкий паттерн, что уже был в OrdersController/OrderService.
- Действия возвращают `Task<IActionResult>` + `NoContent()` (204, тела нет) — тот же стиль, что уже использовался в существующем Confirm-эндпоинте; типизировать нечем, т.к. ответа без тела.
