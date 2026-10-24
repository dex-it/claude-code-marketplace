Готово! Выполнил все требования задачи:

## Созданные/изменённые файлы

- **Services/SmsSender.cs** ✨ (новый) — SMS-отправитель с логированием
- **Services/NotificationServiceKeys.cs** ✨ (новый) — константы для keyed services ("email", "sms")
- **Program.cs** — keyed services регистрация с константами
- **Services/OrderService.cs** — инжекция SMS через [FromKeyedServices]
- **Controllers/ReportsController.cs** ✨ (новый) — эндпоинт POST /reports/{id}/send с email
- **Controllers/OrdersController.cs** — параметр phone для SMS

## О решениях

Использованы keyed services .NET 8: ключи в константах (NotificationServiceKeys), оба отправителя за INotificationSender, разделены по смыслу. OrderService инжектит SMS, ReportsController инжектит Email — через явные [FromKeyedServices], без Service Locator anti-pattern. Оба как Singleton (безопасно для stateless сервисов).

Ответ записан в `_answer.md`.