Добавил SMS-канал и `ReportsController`. Оба отправителя стоят за `INotificationSender` как keyed-сервисы. Сборку и тесты, как и договаривались, не запускал.

**Созданы:**
- `Services/NotificationChannels.cs` — константы ключей `Email = "email"`, `Sms = "sms"`
- `Services/SmsSender.cs` — `SmsSender : INotificationSender`, пока только пишет в лог
- `Controllers/ReportsController.cs` — `POST /reports/{id}/send?email=...`, отправляет отчёт по email
- `_answer.md` — этот же ответ

**Изменены:**
- `Program.cs` — оба отправителя регистрируются через `AddKeyedSingleton<INotificationSender, …>(NotificationChannels.X)`. Регистрации без ключа больше нет, поэтому получить отправителя, не указав канал, нельзя.
- `Services/OrderService.cs` — получает `[FromKeyedServices(NotificationChannels.Sms)]`, параметр теперь `customerPhone`
- `Controllers/OrdersController.cs` — query-параметр `email` заменён на `phone`

**Решения:**
- Ключи вынесены в константы, и одни и те же константы используются в `Program.cs` и в `[FromKeyedServices]`, так что опечатка в ключе не пройдёт компиляцию. Singleton оставил, как было у `EmailSender`: отправители не хранят состояния и зависят только от `ILogger<T>`, поэтому захвата scoped-зависимости нет.
- **Изменение API:** SMS нельзя отправить на email-адрес, поэтому `POST /orders/{id}/confirm` теперь принимает `?phone=` вместо `?email=`. Существующих клиентов нужно предупредить. `{id}` у отчётов сделал `guid`, как у заказов.
- Вне поручения осталось одно расхождение с SKILL.md: `OrderService` по-прежнему регистрируется как конкретный класс, без `IOrderService`.