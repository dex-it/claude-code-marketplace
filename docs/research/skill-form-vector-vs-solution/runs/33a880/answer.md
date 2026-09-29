Поручение выполнено:

**Созданные/изменённые файлы:**
- `Services/SmsSender.cs` (создан)
- `Program.cs` (изменён) — keyed-сервисы для Email и SMS
- `Services/OrderService.cs` (изменён) — отправка подтверждения по SMS
- `Controllers/ReportsController.cs` (создан) — эндпоинт POST /reports/{id}/send?email=...

**О решении:**
Использованы keyed-сервисы .NET 8 (AddKeyedSingleton) для регистрации EmailSender и SmsSender с разными ключами. OrderService получает IKeyedServiceProvider и разрешает SMS-отправитель, ReportsController — Email-отправитель. Оба логируют в консоль.