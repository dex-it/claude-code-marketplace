Добавил SMS-канал и `ReportsController`, оба отправителя подключены как keyed-сервисы .NET 8. Сборку и тесты я не запускал. Этот же ответ записан в `_answer.md`.

## Файлы

Созданы:
- `Services/NotificationChannels.cs`: константы ключей `Email` и `Sms`
- `Services/SmsSender.cs`: `SmsSender : INotificationSender`, пока только пишет в лог
- `Controllers/ReportsController.cs`: `POST /reports/{id}/send?email=...`

Изменены:
- `Program.cs`: оба отправителя регистрируются через `AddKeyedSingleton<INotificationSender, ...>(NotificationChannels.X)`, регистрация без ключа удалена
- `Services/OrderService.cs`: получает `[FromKeyedServices(NotificationChannels.Sms)] INotificationSender`, параметр переименован в `customerPhone`
- `Controllers/OrdersController.cs`: query-параметр `email` заменён на `phone`

## Решения

- Строковые ключи собраны в `const` в классе `NotificationChannels`. Регистрация и `[FromKeyedServices]` берут их оттуда, поэтому опечатка в строке не превратится в ошибку при запуске. Регистрация без ключа удалена, чтобы нельзя было случайно получить отправитель, не выбрав канал.
- Оба отправителя остаются Singleton: у них есть только зависимость от `ILogger`, и они не реализуют `IDisposable`. Scoped `OrderService` получает Singleton-зависимость, то есть время жизни зависимостей соблюдается. `ReportsController` получает email-отправитель через параметр action с `[FromKeyedServices]`, так как .NET 8 поддерживает это в MVC.
- **Ломающее изменение API:** подтверждение заказа теперь уходит по SMS, поэтому `POST /orders/{id}/confirm` принимает `?phone=` вместо `?email=`. Этот вызов нужно обновить у клиентов.