Готово.

**Изменённые/созданные файлы:**
- `Models.cs` — поле `Subscriber.ResumedAt`, новая сущность `UnmatchedPayment`.
- `BillingDbContext.cs` — `DbSet<UnmatchedPayment>` + уникальный индекс по `BankRef`.
- `SubscriberService.cs` — `SearchByPhoneAsync`, `FindTrackedByContractAsync`, `CreditBalance` (зачисление + возврат из Suspended в Active).
- `BankStatementService.cs` (новый) — импорт выписки с идемпотентностью по `BankRef` и откладыванием нераспознанных строк.
- `Program.cs` — DI-регистрация, эндпоинты `POST /bank/statements` и `GET /subscribers/search`.

**Решения:** идемпотентность держится на уникальности `BankRef` (проверка в коде + индексы в БД); логика Suspended→Active живёт в `SubscriberService`, рядом с остальными правилами абонента; поиск по телефону — `EndsWith` + `Take(20)` в SQL. Миграции EF Core не создавались (их в репозитории не было), сборка/тесты не запускались — по ограничению задачи.

Тот же текст сохранён в `_answer.md`.