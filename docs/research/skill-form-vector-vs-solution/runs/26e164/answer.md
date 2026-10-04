Созданные файлы:
- `Services/SmsSender.cs` — второй `INotificationSender`, пишет в лог ("sms to ...").
- `Services/ReportService.cs` — отправка отчёта через email-канал.
- `Controllers/ReportsController.cs` — `POST /reports/{id}/send?email=...`.

Изменённые файлы:
- `Program.cs` — оба отправителя зарегистрированы как keyed-сервисы (`AddKeyedSingleton` с ключами `"email"`/`"sms"`), добавлена регистрация `ReportService`.
- `Services/OrderService.cs` — через `[FromKeyedServices("sms")]` теперь использует `SmsSender` для подтверждения заказа (параметр переименован в `customerPhone`).
- `Controllers/OrdersController.cs` — query-параметр в `confirm` заменён с `email` на `phone`.

Решения: оба канала реализуют один интерфейс и различаются только ключом DI (.NET 8 keyed services), без условной логики в контроллерах; `OrderService` жёстко привязан к `"sms"`, `ReportService` — к `"email"`, согласно требованиям задачи. Ответ также записан в `_answer.md`.