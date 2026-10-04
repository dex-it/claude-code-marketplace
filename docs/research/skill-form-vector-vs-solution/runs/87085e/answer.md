Готово: оба отправителя зарегистрированы как keyed-сервисы, подтверждение заказа уходит по SMS, отчёт — по email. Сборку и тесты не запускал.

**Созданы:**
- `Services/SmsSender.cs` — `SmsSender : INotificationSender`, пока только пишет в лог
- `Services/NotificationChannels.cs` — константы ключей `Email` и `Sms`
- `Controllers/ReportsController.cs` — `POST /reports/{id:guid}/send?email=...`
- `_answer.md` — этот же ответ

**Изменены:**
- `Program.cs` — обычная регистрация заменена на `AddKeyedSingleton<INotificationSender, EmailSender>(NotificationChannels.Email)` и такую же для `SmsSender` с ключом `NotificationChannels.Sms`
- `Services/OrderService.cs` — получает `[FromKeyedServices(NotificationChannels.Sms)] INotificationSender`
- `Controllers/OrdersController.cs` — параметр запроса `email` переименован в `phone`

**Решения:**
- Ключи хранятся как константы в `NotificationChannels`, а не как строки в коде. Поэтому регистрация и `[FromKeyedServices]` не могут разойтись из-за опечатки. Регистрацию `INotificationSender` без ключа я убрал: если канал не указать явно, будет ошибка при разрешении зависимости, а не случайный выбор отправителя.
- Время жизни не менялось. Оба отправителя — singleton и зависят только от `ILogger`, `OrderService` остаётся scoped. Scoped-сервисов внутри singleton нет.
- **Внимание, API меняется несовместимо:** `POST /orders/{id}/confirm` теперь принимает `?phone=` вместо `?email=`, потому что SMS нужно отправлять на номер телефона. Клиентов этого эндпоинта нужно обновить. Если старый контракт надо сохранить, параметр можно вернуть.