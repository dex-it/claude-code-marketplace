SMS-канал, отправка отчётов по email и keyed-регистрации готовы. Сборку и тесты я не запускал, как и было сказано.

**Созданы:**
- `Services/NotificationChannels.cs`: константы ключей `Email` и `Sms`.
- `Services/SmsSender.cs`: `SmsSender : INotificationSender`, пока только пишет в лог.
- `Controllers/ReportsController.cs`: `POST /reports/{id:guid}/send?email=...` отправляет отчёт по email.
- `_answer.md`: этот же ответ.

**Изменены:**
- `Program.cs`: вместо обычной регистрации `INotificationSender` теперь две keyed-регистрации, `AddKeyedSingleton` для `EmailSender` и для `SmsSender`, у каждой свой ключ.
- `Services/OrderService.cs`: получает SMS-отправителя через `[FromKeyedServices(NotificationChannels.Sms)]` в конструкторе.
- `Controllers/OrdersController.cs`: query-параметр `email` переименован в `phone`.

**Решения:**
- Ключи хранятся в одной константе, и её используют и регистрации, и `[FromKeyedServices]`, как требует SKILL.md. Оба отправителя остались Singleton, как раньше `EmailSender`. Регистрацию без ключа я убрал, чтобы один сервис не был зарегистрирован дважды.
- `ReportsController` получает email-отправителя через `[FromKeyedServices]` в параметре action. `IServiceProvider` в коде не используется.
- **Внимание: API стал несовместимым с прежним.** Раз подтверждение уходит по SMS, `POST /orders/{id}/confirm` теперь принимает `?phone=` вместо `?email=`. Клиенты, которые передают `email`, получат 400. Если нужна совместимость со старыми клиентами, это решение можно пересмотреть.