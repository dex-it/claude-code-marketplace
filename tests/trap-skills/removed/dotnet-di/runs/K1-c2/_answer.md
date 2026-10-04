Изменённые/созданные файлы:
- Services/SmsSender.cs (новый) — SmsSender : INotificationSender, пока просто пишет в лог ("sms to {Recipient}").
- Services/INotificationSender.cs (изменён) — добавлен статический класс NotificationChannels с константами Email/Sms — ключи для keyed-сервисов.
- Services/OrderService.cs (изменён) — конструктор теперь принимает INotificationSender через [FromKeyedServices(NotificationChannels.Sms)], т.е. подтверждение заказа теперь уходит по SMS.
- Program.cs (изменён) — вместо AddSingleton<INotificationSender, EmailSender>() зарегистрированы два keyed-сервиса: AddKeyedSingleton<INotificationSender, EmailSender>("email") и AddKeyedSingleton<INotificationSender, SmsSender>("sms").
- Controllers/ReportsController.cs (новый) — POST /reports/{id}/send?email=..., внутри через [FromKeyedServices(NotificationChannels.Email)] берёт email-канал и отправляет "Отчёт {id} готов".

Решения:
- Оба канала (Email/SMS) остаются за единым интерфейсом INotificationSender; выбор конкретной реализации делается не через if/else, а через встроенный keyed DI .NET 8 (AddKeyedSingleton + [FromKeyedServices]), ключи вынесены в константы NotificationChannels, чтобы не размножать строковые литералы.
- OrderService жёстко привязан к SMS-каналу (как и просили — подтверждение заказа теперь уходит по SMS), а ReportsController жёстко привязан к Email-каналу; при необходимости расширения (например, выбор канала рантайм-параметром) их легко переключить на IServiceProvider.GetRequiredKeyedService.
- ReportsController сделан тонким — без отдельного ReportService, т.к. поручение не описывало доменную логику отчётов, только отправку по email; при появлении реальной работы с отчётами это будет отдельный сервис.
