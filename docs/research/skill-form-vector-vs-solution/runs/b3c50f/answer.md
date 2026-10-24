**Созданные файлы:**
- `Services/SmsSender.cs` — второй канал `INotificationSender`, пишет в лог.
- `Services/NotificationChannels.cs` — константы ключей (`"email"`, `"sms"`) для keyed DI.
- `Controllers/ReportsController.cs` — `POST /reports/{id}/send?email=...`, шлёт отчёт через keyed email-отправитель.

**Изменённые файлы:**
- `Program.cs` — оба отправителя зарегистрированы через `AddKeyedSingleton<INotificationSender, ...>(NotificationChannels.Email/Sms)`.
- `Services/OrderService.cs` — принимает `[FromKeyedServices(NotificationChannels.Sms)] INotificationSender`, подтверждение заказа теперь идёт по SMS.
- `Controllers/OrdersController.cs` — параметр `email` переименован в `phone` (соответствует смене канала).

**Решения:** ключи keyed-сервисов вынесены в константы `NotificationChannels`, чтобы не дублировать строки-литералы в местах регистрации и внедрения. Оба отправителя без состояния и scoped-зависимостей — зарегистрированы как keyed Singleton (тот же lifetime, что был у `EmailSender`), а `OrderService` остаётся Scoped и безопасно получает Singleton через конструктор, без обращения к `IServiceProvider` в бизнес-коде.