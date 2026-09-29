Добавил SMS-канал и `ReportsController`, оба отправителя подключены как keyed-сервисы .NET 8. Сборку и тесты я не запускал.

**Созданы:**
- `Services/NotificationChannels.cs`: константы ключей `Email` и `Sms`.
- `Services/SmsSender.cs`: `SmsSender : INotificationSender`, пока только пишет в лог.
- `Controllers/ReportsController.cs`: эндпоинт `POST /reports/{id:guid}/send?email=...`, отправляет отчёт по email.
- `_answer.md`: этот же ответ.

**Изменены:**
- `Program.cs`: оба отправителя зарегистрированы через `AddKeyedSingleton<INotificationSender, ...>(NotificationChannels.*)`. Старая регистрация без ключа удалена.
- `Services/OrderService.cs`: получает SMS-отправителя через `[FromKeyedServices(NotificationChannels.Sms)]`. Параметр переименован в `customerPhone`.
- `Controllers/OrdersController.cs`: параметр запроса `email` заменён на `phone`.

**Решения:**
- Ключи заданы константами в `NotificationChannels`. Одни и те же константы используются при регистрации и в `[FromKeyedServices]`, строк-литералов нет. Отправители зарегистрированы только по ключу, поэтому повторной регистрации нет.
- Оба отправителя остаются Singleton, как раньше был `EmailSender`. Они зависят только от `ILogger`, поэтому передавать их в scoped `OrderService` безопасно.
- **Меняется API:** SMS уходит на телефон, поэтому `POST /orders/{id}/confirm` теперь ожидает `?phone=...` вместо `?email=...`. Клиентов этого эндпоинта нужно предупредить.