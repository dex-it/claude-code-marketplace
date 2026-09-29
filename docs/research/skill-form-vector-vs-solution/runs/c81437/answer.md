Сделал SMS-отправителя, перевёл подтверждение заказа на SMS и добавил `POST /reports/{id}/send`. Сборку и тесты не запускал, как и было сказано. Тот же ответ записан в `_answer.md`.

**Созданы:**
- `Services/SmsSender.cs` — `SmsSender : INotificationSender`, пока только пишет в лог.
- `Services/NotificationChannels.cs` — константы ключей `"email"` и `"sms"`.
- `Controllers/ReportsController.cs` — `POST /reports/{id:guid}/send?email=...`, отправляет отчёт по email.

**Изменены:**
- `Program.cs` — оба отправителя зарегистрированы через `AddKeyedSingleton` с ключами из `NotificationChannels`.
- `Services/OrderService.cs` — берёт SMS-отправителя через `[FromKeyedServices(NotificationChannels.Sms)]`, параметр переименован в `customerPhone`.
- `Controllers/OrdersController.cs` — параметр запроса `email` заменён на `phone`.

**Решения:**
- Ключи вынесены в константы, чтобы не писать строки вручную. Каждый потребитель выбирает канал атрибутом `[FromKeyedServices]` и зависит только от `INotificationSender`. Регистрацию без ключа я убрал, чтобы канал всегда выбирался явно. Если где-то ещё внедряется `INotificationSender` без ключа, при запуске будет ошибка.
- **Это ломает контракт API:** `POST /orders/{id}/confirm` теперь принимает `?phone=` вместо `?email=`, потому что SMS нельзя отправить на адрес почты. Клиентов нужно предупредить. Если нужна совместимость, можно на переходный период принимать оба параметра.
- Сервиса отчётов в проекте нет, поэтому текст письма — заглушка `Отчёт {id}`. Для `id` взят тип `Guid`, как у заказов.