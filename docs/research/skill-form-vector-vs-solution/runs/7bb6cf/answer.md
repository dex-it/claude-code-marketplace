Добавил SMS-канал и `ReportsController`, оба отправителя зарегистрированы как keyed-сервисы. Сборку и тесты не запускал.

**Файлы**
- создан `Services/SmsSender.cs` — `SmsSender : INotificationSender`, пока только пишет в лог
- создан `Services/NotificationChannels.cs` — ключи каналов `"email"` и `"sms"`
- создан `Controllers/ReportsController.cs` — `POST /reports/{id}/send?email=...`
- изменён `Program.cs` — вместо одной обычной регистрации теперь два keyed-синглтона `INotificationSender`
- изменён `Services/OrderService.cs` — получает SMS-отправителя через `[FromKeyedServices(NotificationChannels.Sms)]`
- изменён `Controllers/OrdersController.cs` — параметр запроса `email` заменён на `phone`

**Решения**
- **Меняется контракт API:** `POST /orders/{id}/confirm` теперь принимает `?phone=` вместо `?email=`, потому что отправлять SMS на email-адрес бессмысленно. Существующие клиенты нужно обновить. Если так делать нельзя, нужно решить, откуда брать телефон.
- Регистрация `INotificationSender` без ключа удалена. Если где-то запросить отправителя без ключа, приложение упадёт при запуске, а не отправит сообщение не по тому каналу. Ключи вынесены в константы, чтобы не опечататься в строках.
- В `ReportsController` отправитель внедряется в параметр action через `[FromKeyedServices]`, так как в ASP.NET Core 8 это задокументированный способ. `id` отчёта — `Guid`, как у заказов. Текст отчёта — заглушка `"Отчёт {id}"`, потому что генерации отчётов в проекте нет.

Тот же ответ записан в `_answer.md`.