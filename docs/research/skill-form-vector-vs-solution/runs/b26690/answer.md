Добавил SMS-канал и `ReportsController`, оба отправителя остались за `INotificationSender` и регистрируются как keyed-сервисы. Сборку и тесты не запускал, как было указано. Этот же ответ записан в `_answer.md`.

**Созданы:**
- `Services/NotificationChannels.cs` — константы ключей `Email` и `Sms`
- `Services/SmsSender.cs` — `SmsSender : INotificationSender`, пока пишет в лог
- `Services/IOrderService.cs` — интерфейс для `OrderService`
- `Controllers/ReportsController.cs` — `POST /reports/{id:guid}/send?email=...`, отправляет отчёт по email

**Изменены:**
- `Program.cs` — `AddKeyedSingleton<INotificationSender, EmailSender/SmsSender>(NotificationChannels.X)` и `AddScoped<IOrderService, OrderService>()`
- `Services/OrderService.cs` — получает `[FromKeyedServices(NotificationChannels.Sms)] INotificationSender`; параметр переименован в `customerPhone`
- `Controllers/OrdersController.cs` — зависит от `IOrderService`; query-параметр `email` заменён на `phone`

**Решения:**
- Ключи вынесены в константы, одни и те же при регистрации и в `[FromKeyedServices]`, поэтому опечатку в ключе поймает компилятор, а не runtime. Регистрацию `INotificationSender` без ключа убрал, чтобы канал всегда выбирался явно.
- Отправители остались Singleton: состояния у них нет, из зависимостей только `ILogger`. `OrderService` остался Scoped и теперь регистрируется через интерфейс, как требуют правила команды.
- **Внимание, меняется контракт API:** подтверждение уходит по SMS, поэтому `/orders/{id}/confirm` теперь принимает `?phone=` вместо `?email=`, и клиентов нужно предупредить. Тип `id` в отчётах в задаче не указан, я сделал `Guid` по аналогии с заказами.