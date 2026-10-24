## Изменённые/созданные файлы

- `BankStatementService.cs` (новый) — загрузка и разбор выписки, зачисление платежей, откладывание неразобранных.
- `Models.cs` — добавлены `Subscriber.ReactivatedAt` и сущность `UnmatchedPayment`.
- `BillingDbContext.cs` — `DbSet<UnmatchedPayment>` с уникальным индексом по `BankRef`.
- `SubscriberService.cs` — метод `SearchByPhoneAsync` (поиск по хвосту телефона, LIKE с экранированием, лимит 20).
- `Program.cs` — регистрация `BankStatementService`, эндпоинты `POST /bank/statements` и `GET /subscribers/search`.

## Решения

- Идемпотентность загрузки выписки обеспечена по `BankRef` (уникален и в `Payments`, и в `UnmatchedPayments`): перед обработкой читаем уже встречавшиеся `BankRef` из обеих таблиц и пропускаем такие строки, в том числе дубликаты внутри одного файла.
- Момент зачисления — `Payment.CreditedAt`; момент возврата из Suspended в Active — новое поле `Subscriber.ReactivatedAt`, проставляется сразу после увеличения баланса, если он стал ≥ 0.
- `/bank/statements` читает файл напрямую из тела запроса (`HttpRequest.Body`), без multipart-обёртки.

Тот же текст записан в `_answer.md`. Сборку и тесты не запускал, как просили.