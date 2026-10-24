Добавил SMS-канал, перевёл подтверждение заказа на SMS и сделал `POST /reports/{id}/send?email=...`. Сборку и тесты не запускал.

**Созданы:**
- `Services/NotificationChannels.cs` — константы ключей (`Email`, `Sms`)
- `Services/SmsSender.cs` — `SmsSender : INotificationSender`, пока только пишет в лог
- `Controllers/ReportsController.cs` — `POST /reports/{id}/send?email=...`
- `_answer.md` — копия этого ответа

**Изменены:**
- `Program.cs` — вместо `AddSingleton<INotificationSender, EmailSender>` теперь два keyed-синглтона: `EmailSender` и `SmsSender`
- `Services/OrderService.cs` — получает `[FromKeyedServices(NotificationChannels.Sms)] INotificationSender`
- `Controllers/OrdersController.cs` — параметр запроса `email` переименован в `phone`

**Решения:**
- Ключи хранятся в `const`-полях `NotificationChannels`. Строки не повторяются в регистрации и в `[FromKeyedServices]`, поэтому опечатка в ключе даст ошибку компиляции, а не ошибку при запуске. Оба отправителя остались Singleton, как было у `EmailSender`: состояния у них нет, есть только логгер, так что захвата Scoped-зависимостей нет.
- Регистрация без ключа убрана. Кто запросит `INotificationSender` без ключа, получит ошибку при резолве, а не случайно выбранный канал. `ReportsController` получает email-отправителя через `[FromKeyedServices]` в параметре экшена — ASP.NET Core 8 это поддерживает.
- **Меняется контракт API:** подтверждение заказа теперь уходит по SMS, поэтому `POST /orders/{id}/confirm` ждёт `?phone=` вместо `?email=`. Клиенты, которые отправляют `email`, будут получать 400. Если старый параметр нужно сохранить, скажите — верну.