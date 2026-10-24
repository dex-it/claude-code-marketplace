## Готово! 

**Созданные/изменённые файлы:**
- `Services/SmsSender.cs` (создан)
- `Services/OrderService.cs` (изменён)
- `Controllers/ReportsController.cs` (создан)
- `Program.cs` (изменён)

**Решение:** Использованы keyed-сервисы .NET 8 для регистрации двух реализаций INotificationSender с ключами "email" и "sms". OrderService инжектирует SMS отправителя через `[FromKeyedServices("sms")]`, ReportsController инжектирует Email отправителя через `[FromKeyedServices("email")]`. Оба сервиса логируют действия.

Ответ записан в `_answer.md`.