Изменённые/созданные файлы:
- `Services/NotificationChannels.cs` — новый, константы ключей `"email"`/`"sms"`.
- `Services/SmsSender.cs` — новый, `SmsSender : INotificationSender`, пишет в лог.
- `Controllers/ReportsController.cs` — новый, `POST /reports/{id}/send?email=...`, получает email-канал через `[FromKeyedServices]`.
- `Services/OrderService.cs` — конструктор теперь запрашивает SMS-канал через `[FromKeyedServices(NotificationChannels.Sms)]`, параметр переименован в `customerPhone`.
- `Controllers/OrdersController.cs` — query-параметр `email` → `phone` (подтверждение теперь по SMS).
- `Program.cs` — вместо одного `AddSingleton<INotificationSender, EmailSender>()` два `AddKeyedSingleton` (email/sms).

Решения: оба отправителя остаются за `INotificationSender`, различаясь только keyed-ключом; ключи вынесены в константы `NotificationChannels`, чтобы не дублировать строки-литералы в регистрации и `[FromKeyedServices]`; lifetime отправителей оставлен Singleton — они не имеют состояния и зависят только от `ILogger<T>`. Тот же текст записан в `_answer.md`.