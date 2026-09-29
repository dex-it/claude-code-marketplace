**Созданные файлы:**
- `Services/SmsSender.cs` — `SmsSender : INotificationSender`, пишет в лог.
- `Services/NotificationChannels.cs` — константы ключей `"email"`/`"sms"`.
- `Controllers/ReportsController.cs` — `POST /reports/{id}/send?email=...`.

**Изменённые файлы:**
- `Program.cs` — оба отправителя зарегистрированы как keyed-singleton (`AddKeyedSingleton<INotificationSender, ...>`).
- `Services/OrderService.cs` — берёт SMS-канал через `[FromKeyedServices(NotificationChannels.Sms)]`.
- `Controllers/OrdersController.cs` — параметр запроса `email` → `phone` (теперь это SMS-канал).

**Решения:** оба отправителя скрыты за единым `INotificationSender`, выбор канала через keyed services .NET 8 с ключами-константами (избегаем опечаток в строках); `ReportsController` напрямую использует email-канал без промежуточного `ReportService`, т.к. логика — один вызов отправки. Тот же текст записан в `_answer.md`.