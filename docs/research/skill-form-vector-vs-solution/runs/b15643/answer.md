Готово! Выполнил поручение согласно правилам DI из SKILL.md.

## Созданные/изменённые файлы

1. **Services/SmsSender.cs** — новый отправитель SMS, логирует в ILogger
2. **Services/NotificationServiceKeys.cs** — константы для keyed-сервисов (Email и Sms)
3. **Controllers/ReportsController.cs** — новый controller с POST /reports/{id}/send?email=...
4. **Services/OrderService.cs** — инжекция SMS-отправителя через [FromKeyedServices]
5. **Program.cs** — регистрация обоих отправителей как keyed-сервисы

## Решение

Использованы keyed-сервисы .NET 8 для одновременной регистрации EmailSender и SmsSender под интерфейсом INotificationSender. Ключи вынесены в константы (SKILL.md запрещает магические строки). OrderService получает SMS через keyed-инжекцию, ReportsController — Email. Оба остаются за интерфейсом, обеспечивая гибкость и тестируемость.