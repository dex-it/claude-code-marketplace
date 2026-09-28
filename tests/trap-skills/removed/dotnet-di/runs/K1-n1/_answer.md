Созданные файлы:
- Services/NotificationChannels.cs — константы ключей keyed-сервисов (`Email`, `Sms`), чтобы строка-литерал не дублировалась в регистрации и в `[FromKeyedServices]`.
- Services/SmsSender.cs — второй `INotificationSender`, пока пишет в лог (`sms to {Recipient}`).
- Services/ReportService.cs — тонкий сервис для отчётов, использует keyed `INotificationSender` (email).
- Controllers/ReportsController.cs — `POST /reports/{id:guid}/send?email=...`, по схеме и стилю аналогичен `OrdersController`.

Изменённые файлы:
- Program.cs — `EmailSender`/`SmsSender` зарегистрированы как `AddKeyedSingleton<INotificationSender, ...>` под ключами `NotificationChannels.Email`/`Sms`; добавлен `AddScoped<ReportService>()`.
- Services/OrderService.cs — внедряется `[FromKeyedServices(NotificationChannels.Sms)] INotificationSender`, подтверждение заказа теперь уходит по SMS; параметр переименован в `customerPhone`.
- Controllers/OrdersController.cs — query-параметр `email` переименован в `phone` (соответствует смене канала на SMS).

Решения:
- Оба канала остаются за `INotificationSender`; выбор канала — через .NET 8 keyed DI (`AddKeyedSingleton` + `[FromKeyedServices]`), ключи вынесены в константы `NotificationChannels`, а не разбросаны строковыми литералами (это отдельно отмечено в SKILL.md команды).
- `ReportsController` сделан тонким и повторяет паттерн `OrdersController` (роут без префикса `api/`, `id:guid` в path, получатель — в query) для согласованности URL-схемы сервиса.
- Раз подтверждение заказа переехало на SMS, у `OrderService`/`OrdersController` получатель переименован из email в phone, чтобы контракт отражал реальный канал доставки.
