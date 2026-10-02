SMS-канал и `ReportsController` добавлены. Сборку и тесты не запускал, как и требовалось. Одно изменение ломает текущий API: `POST /orders/{id}/confirm` теперь принимает `?phone=` вместо `?email=`.

**Созданы:**
- `Services/SmsSender.cs` — `SmsSender : INotificationSender`, пока только пишет в лог.
- `Services/NotificationChannels.cs` — константы ключей `"email"` / `"sms"`.
- `Controllers/ReportsController.cs` — `POST /reports/{id}/send?email=...`, отправляет отчёт по email.

**Изменены:**
- `Program.cs` — вместо обычной регистрации `EmailSender` теперь два keyed-синглтона (`AddKeyedSingleton`): для email и для sms.
- `Services/OrderService.cs` — получает SMS-отправителя через `[FromKeyedServices(NotificationChannels.Sms)]`.
- `Controllers/OrdersController.cs` — параметр `email` переименован в `phone`.

**Решения:**
- Оба отправителя зарегистрированы только по ключу, без варианта по умолчанию. Так канал всегда указывается явно, и случайно получить не тот отправитель нельзя. Ключи вынесены в константы, чтобы исключить опечатки.
- Параметр заказа переименован, потому что SMS нельзя отправить на email-адрес. Клиентов этого эндпоинта нужно предупредить. Если нужна обратная совместимость, могу оставить `email` на переходный период.
- `{id}` у отчётов сделан `Guid`, как у заказов. Модели отчёта в проекте нет, поэтому текст сообщения пока просто «Отчёт {id}».

Этот же ответ записан в `_answer.md`.