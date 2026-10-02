Созданные/изменённые файлы:
- **Services/NotificationChannel.cs** (новый) — константы ключей `"email"`/`"sms"` для keyed-сервисов
- **Services/SmsSender.cs** (новый) — `SmsSender : INotificationSender`, пишет в лог
- **Services/OrderService.cs** — конструктор теперь принимает `[FromKeyedServices(NotificationChannel.Sms)] INotificationSender`
- **Controllers/OrdersController.cs** — параметр `email` переименован в `phone` (подтверждение теперь идёт по SMS)
- **Controllers/ReportsController.cs** (новый) — `POST /reports/{id}/send?email=...`, использует `[FromKeyedServices(NotificationChannel.Email)] INotificationSender`
- **Program.cs** — `AddSingleton<INotificationSender, EmailSender>()` заменён на два `AddKeyedSingleton` по ключам из `NotificationChannel`

Оба отправителя зарегистрированы как keyed Singleton за одним интерфейсом `INotificationSender`, ключи вынесены в константы (чтобы избежать опечаток, см. чек-лист SKILL.md). Singleton оправдан, т.к. отправители не хранят состояние и не тянут Scoped-зависимости; канал выбирается через конструкторную инъекцию `[FromKeyedServices]`, без Service Locator. Тот же текст записан в `work/_answer.md`.