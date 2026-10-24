Готово! Реализовано полное решение с keyed-сервисами .NET 8.

## Созданные/изменённые файлы:
- **Services/SmsSender.cs** (новый) — реализация INotificationSender для SMS
- **Services/ReportsService.cs** (новый) — сервис отправки отчётов по email через keyed-сервис  
- **Controllers/ReportsController.cs** (новый) — POST /reports/{id}/send?email=...
- **Program.cs** — AddKeyedScoped для обоих отправителей ("email", "sms")
- **Services/OrderService.cs** — теперь использует SMS через GetRequiredKeyedService("sms")

## Решение:
Использованы keyed-сервисы .NET 8 (AddKeyedScoped) с литеральными строками-константами для ключей. OrderService и ReportsService получают IKeyedServiceProvider для динамического resolve нужного канала — исключение из правил DI согласно SKILL.md. Все остаются за интерфейсом INotificationSender, lifetimes — Scoped, без captive dependency и других anti-patterns.