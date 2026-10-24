Готово. Сборку и тесты не запускал по ограничению.

**Файлы:**
- `Services/SmsSender.cs` (новый) — `INotificationSender`, пишет в лог.
- `Services/OrderService.cs` — использует `[FromKeyedServices("sms")]`.
- `Controllers/OrdersController.cs` — параметр `email` → `phone`.
- `Controllers/ReportsController.cs` (новый) — `POST /reports/{id}/send?email=...`, использует `[FromKeyedServices("email")]`.
- `Program.cs` — `AddKeyedSingleton<INotificationSender, EmailSender>("email")` и `AddKeyedSingleton<INotificationSender, SmsSender>("sms")`.

**Решения:** оба канала остаются за одним `INotificationSender`, различаются через keyed-сервисы .NET 8 (`AddKeyedSingleton`/`[FromKeyedServices]`) — без доп. интерфейсов и фабрик. Ответ также записан в `_answer.md`.