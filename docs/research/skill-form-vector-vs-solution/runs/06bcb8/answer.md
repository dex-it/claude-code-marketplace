## Изменённые/созданные файлы

- `Services/SmsSender.cs` — новый: `SmsSender : INotificationSender`, пишет в лог (по аналогии с `EmailSender`).
- `Services/NotificationChannels.cs` — новый: константы `Email`/`Sms` для keyed-сервисов.
- `Services/OrderService.cs` — зависимость переключена на `[FromKeyedServices(NotificationChannels.Sms)] INotificationSender`; параметр переименован в `customerPhone`.
- `Controllers/OrdersController.cs` — query-параметр `email` → `phone`.
- `Controllers/ReportsController.cs` — новый: `POST /reports/{id}/send?email=...`, резолвит email-канал через конструктор.
- `Program.cs` — регистрация обоих отправителей как `AddKeyedSingleton` вместо одного `AddSingleton`.

Решения: оба отправителя без состояния, поэтому остались Singleton, но зарегистрированы как keyed — SMS для `OrderService`, email для `ReportsController`, резолв через `[FromKeyedServices]`. Ключи вынесены в константы `NotificationChannels`, чтобы избежать опечаток (правило из SKILL.md). Параметр в `OrdersController`/`OrderService` переименован email→phone, так как подтверждение теперь уходит по SMS. Тот же текст записан в `_answer.md`.