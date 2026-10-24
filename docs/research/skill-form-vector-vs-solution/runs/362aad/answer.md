Готово! Выполнил поручение:

## Созданные/изменённые файлы:
- **Services/SmsSender.cs** — новый (реализация INotificationSender, логирует в консоль)
- **Program.cs** — изменён (keyed-сервисы: `AddKeyedSingleton<INotificationSender, EmailSender>("email")` и `AddKeyedSingleton<INotificationSender, SmsSender>("sms")`)
- **Services/OrderService.cs** — изменён (инъекция keyed-сервиса SMS через `[FromKeyedServices("sms")]`)
- **Controllers/ReportsController.cs** — новый (POST /reports/{id}/send?email=..., инъекция keyed-сервиса Email)

## Решение:
Использованы keyed-сервисы .NET 8 с чистыми строковыми литералами ("email", "sms") для регистрации и инъекции. OrderService получает SMS через `[FromKeyedServices("sms")]`, ReportsController — Email через `[FromKeyedServices("email")]`. Оба отправителя остаются за интерфейсом `INotificationSender`, что обеспечивает гибкость и расширяемость.

Результат записан в `_answer.md`.