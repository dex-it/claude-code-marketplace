Готово! Добавил второй канал уведомлений с использованием keyed-сервисов .NET 8.

**Созданные/изменённые файлы:**
- `Services/SmsSender.cs` — новый отправитель SMS
- `Program.cs` — keyed-сервисы для Email и SMS с ключами
- `Services/OrderService.cs` — получает SmsSender через фабрику
- `Controllers/ReportsController.cs` — новый контроллер с POST /reports/{id}/send?email=...
- `Controllers/OrdersController.cs` — параметр переименован в phone
- `_answer.md` — описание решения

**Решение:** Использованы `AddKeyedSingleton<INotificationSender>` с ключами "email" и "sms" в Program.cs. OrderService инъектится через фабрику, получая SMS-сервис; ReportsController через `[FromKeyedServices("email")]` получает Email-сервис. Оба способа соответствуют правилам SKILL.md.