Готово. Сборку/тесты не запускал, как и просили.

**Создано:**
- `Services/SmsSender.cs` — второй `INotificationSender`, пишет в лог
- `Services/NotificationChannel.cs` — константы ключей keyed-сервисов (`email`, `sms`)
- `Controllers/ReportsController.cs` — `POST /reports/{id}/send?email=...`

**Изменено:**
- `Program.cs` — `EmailSender`/`SmsSender` зарегистрированы через `AddKeyedSingleton<INotificationSender, ...>`
- `Services/OrderService.cs` — теперь запрашивает SMS-канал через `[FromKeyedServices(NotificationChannel.Sms)]`
- `Controllers/OrdersController.cs` — query-параметр `email` → `phone` (подтверждение теперь идёт по SMS)

**Решения:** оба отправителя остаются за `INotificationSender`, выбор канала — через keyed DI из .NET 8 (`AddKeyedSingleton` + `[FromKeyedServices]`); ключи вынесены в константы `NotificationChannel`, чтобы регистрация и точки внедрения не разошлись по строкам-литералам. Тот же текст сохранён в `_answer.md`.