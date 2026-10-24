Оба канала работают через keyed-сервисы: подтверждение заказа уходит по SMS, отчёт — по email. Сборку и тесты я не запускал. Есть **ломающее изменение API**: `/orders/{id}/confirm` теперь принимает `?phone=` вместо `?email=`, потому что SMS на email-адрес не отправить. Клиентов этого эндпоинта нужно обновить.

**Созданы:**
- `Services/NotificationChannels.cs` — константы ключей `Email` / `Sms`
- `Services/SmsSender.cs` — `SmsSender : INotificationSender`, пока пишет в лог
- `Services/ReportService.cs` — `IReportService` / `ReportService`, получает email-отправителя по ключу
- `Controllers/ReportsController.cs` — `POST /reports/{id:guid}/send?email=...`
- `_answer.md` — этот ответ

**Изменены:**
- `Program.cs` — `AddKeyedSingleton` для обоих отправителей; сервисы регистрируются как интерфейс → реализация
- `Services/OrderService.cs` — добавлен `IOrderService`, в конструкторе `[FromKeyedServices(NotificationChannels.Sms)]`
- `Controllers/OrdersController.cs` — зависит от `IOrderService`, query-параметр `email` заменён на `phone`

**Решения:**
- Ключи вынесены в константы `NotificationChannels`. Обычную (без ключа) регистрацию `INotificationSender` я убрал, так что по умолчанию никакой канал не подставится незаметно.
- Отправители — Singleton: у них нет состояния и есть только `ILogger`. `OrderService` и `ReportService` — Scoped.