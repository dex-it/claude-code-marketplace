Готово! Добавил функционал для трёх задач по биллингу:

**Файлы изменены:**
- **Models.cs** — поле `RestoredAt` в Subscriber, класс `UnreconciledPayment` для неразобранных платежей
- **BillingDbContext.cs** — DbSet и конфигурация для UnreconciledPayment  
- **SubscriberService.cs** — методы `LoadBankStatementAsync()` и `SearchByPhoneAsync()`
- **Program.cs** — эндпоинты `/bank/statements` (POST) и `/subscribers/search` (GET)

**Решения:**
- (a) Выписка парсится, платежи зачисляются по контрактному номеру из назначения; повтор не дублирует благодаря уникальному индексу на BankRef; неразобранные откладываются в UnreconciledPayment
- (b) При платеже автоматически проверяется баланс Suspended абонента — если ≥ 0, переводим в Active с сохранением времени в RestoredAt
- (в) Поиск по последним цифрам телефона, до 20 результатов