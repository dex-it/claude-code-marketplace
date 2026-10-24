Изменённые/созданные файлы:
- Services/SmsSender.cs (новый) — SmsSender : INotificationSender, пока пишет в лог ("sms to {Recipient}"), по аналогии с EmailSender.
- Program.cs — регистрация обоих отправителей как keyed-сервисы: AddKeyedSingleton<INotificationSender, EmailSender>("email") и AddKeyedSingleton<INotificationSender, SmsSender>("sms").
- Services/OrderService.cs — конструктор теперь берёт [FromKeyedServices("sms")] INotificationSender; параметр подтверждения переименован customerEmail → customerPhone, т.к. подтверждение заказа уходит по SMS.
- Controllers/OrdersController.cs — query-параметр эндпоинта /orders/{id}/confirm переименован email → phone вслед за изменением канала на SMS.
- Controllers/ReportsController.cs (новый) — POST /reports/{id}/send?email=..., резолвит [FromKeyedServices("email")] INotificationSender и шлёт текст "Отчёт {id} готов" на указанный email.

Решения:
- INotificationSender остался единственным контрактом для обоих каналов; выбор конкретной реализации сделан через встроенные keyed DI-сервисы .NET 8 (AddKeyedSingleton/[FromKeyedServices]) без доп. фабрик или enum-диспетчеров.
- Раз подтверждение заказа теперь идёт по SMS, а не по email, переименовал параметр в OrderService/OrdersController в customerPhone/phone — отправка SMS на "email"-параметр была бы вводящей в заблуждение сигнатурой; сам SendAsync(recipient, text) остался неизменным для обоих каналов.
- ReportsController сделан отдельным тонким контроллером, жёстко привязанным к keyed "email"-отправителю (отчёты по email), без создания отдельной сущности Report — её в проекте не было, а по ТЗ нужен только сам эндпоинт отправки.
