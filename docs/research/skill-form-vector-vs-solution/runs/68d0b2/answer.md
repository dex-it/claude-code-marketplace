Изменения готовы. Сборку и тесты не запускал, так что код не проверен.

**Созданы:**
- `Services/NotificationChannels.cs`: константы ключей `Email` и `Sms`.
- `Services/SmsSender.cs`: `SmsSender : INotificationSender`, пока только пишет в лог.
- `Controllers/ReportsController.cs`: эндпоинт `POST /reports/{id}/send?email=...`.
- `_answer.md`: этот же ответ.

**Изменены:**
- `Program.cs`: два `AddKeyedSingleton<INotificationSender, ...>` вместо одной обычной регистрации.
- `Services/OrderService.cs`: получает `[FromKeyedServices(NotificationChannels.Sms)]`.
- `Controllers/OrdersController.cs`: параметр запроса `email` переименован в `phone`.

**Решения:**
- **Ключи:** оба отправителя зарегистрированы только по ключу, ключ задан одной константой из `NotificationChannels` и в регистрации, и в `[FromKeyedServices]`. Обычную регистрацию `INotificationSender` я убрал, чтобы сервис не был зарегистрирован дважды: без ключа его никто не запрашивает. Время жизни осталось Singleton, как было у `EmailSender`: у отправителей нет scoped-зависимостей, только логгер.
- **Контроллер отчётов:** email-отправитель внедряется в параметр действия через `[FromKeyedServices]`. ASP.NET Core 8 это официально поддерживает, `IServiceProvider` в коде не используется.
- **Нужно ваше решение:** раз подтверждение заказа уходит по SMS, `POST /orders/{id}/confirm` теперь принимает `?phone=` вместо `?email=`. Это ломает текущий API: клиенты, которые шлют `?email=`, перестанут работать. Если контракт нужно сохранить, скажите, и я верну `email` рядом с `phone`.