Готово! Я реализовал все три задачи:

**Изменённые файлы:**
- `Models.cs` - добавлены `UnresolvedPayment` и `SuspendedReactivation`
- `BillingDbContext.cs` - добавлены DbSet и конфигурация индексов
- `SubscriberService.cs` - добавлены методы `ProcessBankStatementAsync` и `SearchByPhoneAsync`
- `Program.cs` - добавлены endpoints для выписки и поиска
- `_answer.md` - записан ответ с описанием решений

**Краткие решения:**

**(а)** POST /bank/statements разбирает CSV, проверяет BankRef на дубли, находит абонента по номеру договора и зачисляет платёж; неразобранные откладываются в UnresolvedPayment.

**(б)** После каждого зачисления проверяется, стал ли баланс Suspended-абонента неотрицательным; если да — переводим в Active с сохранением момента в SuspendedReactivation.

**(в)** GET /subscribers/search?phone=4518 ищет по окончанию номера LIKE-паттерном, максимум 20 результатов.