Добавил SMS-канал, `ReportsController` и keyed-регистрацию обоих отправителей. Сборку и тесты не запускал.

**Созданы:**
- `Services/NotificationChannels.cs` — константы ключей `Email` и `Sms`
- `Services/SmsSender.cs` — `SmsSender : INotificationSender`, пока пишет в лог
- `Controllers/ReportsController.cs` — `POST /reports/{id:guid}/send?email=...`, отправляет отчёт через email-отправителя
- `_answer.md` — этот же ответ

**Изменены:**
- `Program.cs` — вместо `AddSingleton<INotificationSender, EmailSender>()` оба отправителя регистрируются через `AddKeyedSingleton`
- `Services/OrderService.cs` — получает `[FromKeyedServices(NotificationChannels.Sms)] INotificationSender`, параметр переименован в `customerPhone`
- `Controllers/OrdersController.cs` — query-параметр `email` заменён на `phone`

**Решения:**
- Ключи заданы константами в `NotificationChannels`: одни и те же константы используются при регистрации и в `[FromKeyedServices]`, строковых литералов нет. Регистрацию `INotificationSender` без ключа убрал, чтобы сервис не был зарегистрирован дважды.
- Оба отправителя остались Singleton, как было у `EmailSender`. Они зависят только от `ILogger<T>`, поэтому scoped-зависимость в Singleton не попадает.
- **Ломающее изменение API:** подтверждение заказа теперь уходит по SMS, поэтому `POST /orders/{id}/confirm` принимает `?phone=` вместо `?email=`. Нужно предупредить клиентов этого эндпоинта.