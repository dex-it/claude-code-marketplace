Подтверждение заказа теперь уходит по SMS, `POST /reports/{id}/send?email=...` отправляет отчёт по email. Оба отправителя остаются за `INotificationSender` и регистрируются как keyed-сервисы. Сборку и тесты я не запускал, как и требовалось.

**Созданы:**
- `Services/SmsSender.cs` — `SmsSender : INotificationSender`, пока только пишет в лог.
- `Services/NotificationChannels.cs` — константы ключей `"email"` и `"sms"`.
- `Controllers/ReportsController.cs` — эндпоинт `POST /reports/{id}/send?email=...`.
- `_answer.md` — копия этого ответа.

**Изменены:**
- `Program.cs` — вместо одной обычной регистрации два `AddKeyedSingleton<INotificationSender, ...>(key)`.
- `Services/OrderService.cs` — получает отправителя через `[FromKeyedServices(NotificationChannels.Sms)]`.
- `Controllers/OrdersController.cs` — query-параметр `email` заменён на `phone`.

**Решения:**
- Обычной регистрации `INotificationSender` больше нет, только по ключам. Каждый потребитель явно выбирает канал, и никто не получит его случайно. Ключи вынесены в константы, чтобы не ошибиться в строках.
- **Ломающее изменение API:** SMS нельзя отправить на email-адрес, поэтому `POST /orders/{id}/confirm` теперь ждёт `?phone=` вместо `?email=`. Клиентов этого эндпоинта нужно предупредить. Если нужна обратная совместимость, можно временно принимать оба параметра.
- `id` отчёта принимается как `Guid`, так же как у заказов. Настоящего отчёта в проекте нет, поэтому письмо пока содержит только текст-заглушку «Отчёт {id}».