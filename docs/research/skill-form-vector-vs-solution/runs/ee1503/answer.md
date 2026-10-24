Готово.

**Созданные файлы:**
- `Services/SmsSender.cs` — `SmsSender : INotificationSender`, пишет в лог.
- `Services/NotificationChannels.cs` — константы ключей (`Email`, `Sms`) для keyed-сервисов.
- `Services/ReportService.cs` — отправка отчёта по email.
- `Controllers/ReportsController.cs` — `POST /reports/{id}/send?email=...`.

**Изменённые файлы:**
- `Program.cs` — вместо одиночного `AddSingleton<INotificationSender, EmailSender>()` теперь два `AddKeyedSingleton` (email/sms) + `AddScoped<ReportService>()`.
- `Services/OrderService.cs` — конструктор теперь берёт `[FromKeyedServices(NotificationChannels.Sms)] INotificationSender`, подтверждение заказа уходит по SMS.

**Решения:** выбор канала сделан через keyed DI (.NET 8) без ветвлений в коде; ключи вынесены в константы `NotificationChannels`, чтобы регистрация и `[FromKeyedServices]` не расходились строкой-литералом (пункт чек-листа SKILL.md); `ReportsController` не трогает `INotificationSender` напрямую — логика в `ReportService`, как у `OrderService`.