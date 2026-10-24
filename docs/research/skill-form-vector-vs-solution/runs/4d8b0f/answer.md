## ✅ Готово

**Созданные/Изменённые файлы:**
- `Services/SmsSender.cs` (создан) - SMS отправитель с логированием
- `Services/OrderService.cs` (изменён) - использует keyed-сервис "sms"
- `Controllers/ReportsController.cs` (создан) - эндпоинт POST /reports/{id}/send для отправки отчетов по email
- `Controllers/OrdersController.cs` (изменён) - параметр phone вместо email
- `Program.cs` (изменён) - регистрация keyed-сервисов "email" и "sms"
- `_answer.md` (создан)

**О решении:**
Использованы keyed-сервисы .NET 8 для регистрации EmailSender и SmsSender под ключами "email" и "sms". OrderService внедряет SMS через `[FromKeyedServices("sms")]` для подтверждения заказов, ReportsController использует email через `[FromKeyedServices("email")]`. Оба отправителя остаются за интерфейсом INotificationSender с логированием операций.