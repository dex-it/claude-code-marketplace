## Изменённые/созданные файлы

- `Models.cs` — добавлены `Subscriber.ReactivatedAt` (момент возврата в Active) и новая сущность `UnmatchedPayment` (неразобранные строки выписки).
- `BillingDbContext.cs` — `DbSet<UnmatchedPayment>`, уникальный индекс по `BankRef` для неё же.
- `BankStatementService.cs` (новый) — импорт выписки: разбор через `BankStatement.Parse`, извлечение номера договора через `PaymentPurpose`, зачисление на баланс абонента, авто-возврат из Suspended в Active при неотрицательном балансе, запись несопоставленных строк в `UnmatchedPayments`.
- `SubscriberService.cs` — метод `SearchByPhoneAsync` (поиск по окончанию номера телефона, лимит 20).
- `Program.cs` — регистрация `BankStatementService`, эндпоинты `POST /bank/statements` и `GET /subscribers/search?phone=`.

## Решения

Идемпотентность обеспечена уникальным `BankRef` (уже был уникальный индекс у `Payment`, добавил такой же у `UnmatchedPayment`); повторный импорт просто пропускает уже встречавшиеся строки. Файл выписки читается напрямую из тела запроса (`StreamReader` над `HttpRequest.Body`), без multipart. Поиск по телефону — через `string.EndsWith`, EF Core транслирует это в безопасный параметризованный `LIKE`.

Ответ также записан в `_answer.md`.