## Изменённые/созданные файлы

- `Models.cs` — добавлено поле `Subscriber.ReactivatedAt` (момент возврата из Suspended в Active) и новая сущность `UnmatchedPayment` для неразобранных строк выписки.
- `BillingDbContext.cs` — добавлен `DbSet<UnmatchedPayment>` с уникальным индексом по `BankRef`.
- `BankStatementService.cs` (новый) — импорт выписки: парсинг через существующий `BankStatement.Parse`, поиск абонента по номеру договора из `PaymentPurpose.ExtractContractNo`, зачисление на баланс и сохранение `Payment.CreditedAt`; строки без найденного абонента уходят в `UnmatchedPayments`.
- `SubscriberService.cs` — добавлен `SearchByPhoneAsync` (поиск по окончанию номера телефона, `Take(20)`).
- `Program.cs` — регистрация `BankStatementService`, эндпоинты `POST /bank/statements` (тело запроса — CSV-файл выписки) и `GET /subscribers/search?phone=...`.

## Решения

Повторная загрузка выписки не дублирует платежи: уникальные индексы `Payment.BankRef`/`UnmatchedPayment.BankRef` плюс предпроверка уже встречавшихся `BankRef` из обоих наборов. Возврат в `Active` проверяется сразу после зачисления (`Balance >= 0` у Suspended), момент сохраняется в `ReactivatedAt`. Поиск по телефону — `Phone.EndsWith(suffix)`, ограничен 20 записями.

Тот же текст записан в `_answer.md`.