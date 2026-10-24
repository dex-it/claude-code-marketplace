Добавил SMS-канал через keyed-сервисы: подтверждение заказа теперь уходит по SMS, а отчёты отправляются по email через новый `ReportsController`. Сборку и тесты не запускал, как требуют ограничения.

**Созданы:**
- `Services/NotificationChannels.cs` — константы ключей (`Email`, `Sms`)
- `Services/SmsSender.cs` — `SmsSender : INotificationSender`, пока только пишет в лог
- `Controllers/ReportsController.cs` — `POST /reports/{id}/send?email=...`, отправляет через email-отправителя
- `_answer.md` — этот же ответ

**Изменены:**
- `Program.cs` — вместо обычной регистрации теперь два keyed-сервиса: `AddKeyedSingleton<INotificationSender, EmailSender/SmsSender>(NotificationChannels.*)`
- `Services/OrderService.cs` — получает `[FromKeyedServices(NotificationChannels.Sms)] INotificationSender`, параметр переименован в `customerPhone`
- `Controllers/OrdersController.cs` — query-параметр `email` → `phone`

**Решения:**
- Ключи хранятся в константах `NotificationChannels`, а не в строках-литералах, как требует SKILL.md. Одна константа используется и при регистрации, и в `[FromKeyedServices]`, так что опечатка в ключе не скомпилируется. Обычная регистрация `INotificationSender` без ключа удалена, поэтому канал везде нужно выбирать явно.
- Оба отправителя остаются Singleton: у них нет состояния и есть только зависимость `ILogger<T>` (она тоже Singleton), так что Scoped-сервис в Singleton не захватывается. Когда появится настоящая отправка SMS, этот lifetime нужно проверить заново.
- **Контракт API меняется:** `POST /orders/{id}/confirm` теперь принимает `?phone=` вместо `?email=`, потому что SMS нельзя отправить на email-адрес. Клиентов нужно предупредить. Если прежний контракт важнее, могу оставить `email` и добавить `phone` рядом. `OrderService` по-прежнему регистрируется как конкретный класс, без интерфейса; это отступление от SKILL.md я не трогал, чтобы не расширять задачу.