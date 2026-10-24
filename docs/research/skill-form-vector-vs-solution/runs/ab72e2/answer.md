Готово! Реализовано решение с keyed-сервисами:

**Созданные/изменённые файлы:**
- `Services/SmsSender.cs` — новый SMS-отправитель
- `Controllers/ReportsController.cs` — новый контроллер с эндпоинтом отправки отчётов  
- `Services/OrderService.cs` — обновлена для SMS через keyed-сервис
- `Program.cs` — регистрация keyed-сервисов

**Решение:**
Использованы keyed-сервисы .NET 8 с ключами "email" и "sms". OrderService инъецирует SMS-отправитель через `[FromKeyedServices("sms")]`, ReportsController — email-отправитель через `[FromKeyedServices("email")]`. Оба отправителя остаются за интерфейсом INotificationSender, обеспечивая единую абстракцию и легкое расширение.