Созданные файлы:
- Services/SmsSender.cs — `SmsSender : INotificationSender`, пишет в лог (`ILogger<SmsSender>`).
- Services/ReportService.cs — тонкий сервис для контроллера отчётов, шлёт письмо через keyed `"email"`-отправителя.
- Controllers/ReportsController.cs — `POST /reports/{id}/send?email=...`, роутинг без бизнес-логики.

Изменённые файлы:
- Program.cs — регистрация обоих отправителей как keyed-сервисов (`AddKeyedSingleton<INotificationSender, EmailSender>("email")`, `AddKeyedSingleton<INotificationSender, SmsSender>("sms")`) + регистрация `ReportService`.
- Services/OrderService.cs — конструктор теперь берёт `[FromKeyedServices("sms")] INotificationSender`, т.е. подтверждение заказа уходит по SMS.

Решения:
- Оба канала остаются за `INotificationSender`; выбор канала — только через ключ `.NET 8 keyed services` ("email"/"sms"), без if/else и веток по типу отправителя.
- `ReportsController` не содержит логики отправки — она вынесена в `ReportService` (как и в `OrdersController`/`OrderService`), чтобы не плодить толстые контроллеры.
- `OrdersController` и его контракт (`?email=`) не трогал — задание просило сменить только канал внутри `OrderService`, не публичный контракт confirm-эндпоинта.
