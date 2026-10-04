Добавил SMS-канал и эндпоинт отправки отчётов. Оба отправителя стоят за `INotificationSender` как keyed-сервисы. Сборку и тесты, как и договаривались, не запускал.

**Созданы:**
- `Services/NotificationChannels.cs`: ключи `Email` и `Sms` в виде `const`.
- `Services/SmsSender.cs`: `SmsSender : INotificationSender`, пока только пишет в лог.
- `Services/ReportService.cs`: отправляет отчёт через email-отправителя.
- `Controllers/ReportsController.cs`: `POST /reports/{id:guid}/send?email=...`.
- `_answer.md`: этот же ответ.

**Изменены:**
- `Program.cs`: оба отправителя зарегистрированы через `AddKeyedSingleton<INotificationSender, ...>`, `ReportService` добавлен как Scoped.
- `Services/OrderService.cs`: получает отправителя через `[FromKeyedServices(NotificationChannels.Sms)]`.
- `Controllers/OrdersController.cs`: query-параметр `email` заменён на `phone`.

**Решения:**
- **Ключи:** одни и те же константы из `NotificationChannels` используются и при регистрации, и в `[FromKeyedServices]`, поэтому строки-ключи не могут разойтись. Старую регистрацию `INotificationSender` без ключа удалил, чтобы один сервис не был зарегистрирован дважды. Отправители остались Singleton: они зависят только от `ILogger<T>`, Scoped-зависимостей внутри нет.
- **Меняется API заказов:** отправить SMS на email-адрес нельзя, поэтому `POST /orders/{id}/confirm` теперь принимает `?phone=` вместо `?email=`. Существующих клиентов этого эндпоинта нужно обновить. Если нужна обратная совместимость, могу временно принимать оба параметра.
- **Отчёты:** сделаны по образцу заказов: контроллер → Scoped-сервис → отправитель по ключу. Id отчёта сделал `Guid`, как у заказов, — в задаче тип не был указан.