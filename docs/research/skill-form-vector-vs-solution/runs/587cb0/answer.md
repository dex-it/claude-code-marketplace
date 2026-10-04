Готово. Созданы/изменены файлы:

**Созданы:**
- `Services/SmsSender.cs` — `INotificationSender`, пишет в лог
- `Services/NotificationChannels.cs` — константы ключей ("email"/"sms") для keyed-сервисов
- `Controllers/ReportsController.cs` — `POST /reports/{id}/send?email=...`

**Изменены:**
- `Program.cs` — `AddKeyedSingleton<INotificationSender, EmailSender/SmsSender>` вместо одного `AddSingleton`
- `Services/OrderService.cs` — получает SMS-канал через `[FromKeyedServices(NotificationChannels.Sms)]`
- `Controllers/OrdersController.cs` — query-параметр `email` → `phone`

Оба отправителя разведены через keyed DI .NET 8 без ветвления в бизнес-логике; ключи вынесены в константы, чтобы литералы в регистрации и в `[FromKeyedServices]` не разошлись. Ответ также записан в `_answer.md`.