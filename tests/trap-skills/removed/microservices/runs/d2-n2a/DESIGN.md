# DESIGN: BILL-41 - оплата счёта с предоплаченного баланса (Wallet)

Статус: проект, кода нет. Опирается на ADR-0002, 0004, 0006, 0007, RUL-0003 и на BILL-34 (Postgres).

## 1. Ключевые решения

1. **Оплата с баланса всегда асинхронна.** `POST /invoices/{id}/pay-from-wallet` не ждёт Wallet:
   он переводит счёт `Issued -> PaymentPending` и отвечает `202 Accepted`. Списание выполняет фоновый
   обработчик. Ручная и ночная оплата идут одним путём, поэтому защита от двойного списания
   одна и в одном месте. Причина: Wallet отвечает до 40 с, лежит 3-5 минут и до получаса; держать
   HTTP-запрос кабинета на это время нельзя.
2. **Двойное списание исключают три слоя**: (a) переход состояния только методом `Invoice` и
   оптимистичная конкурентность в Postgres - выигрывает ровно один инициатор; (b) детерминированный
   `Idempotency-Key` на счёт; (c) при неопределённом исходе счёт остаётся `PaymentPending` и
   повторяется с тем же ключом, а не возвращается в `Issued`.
3. **Проводка и чек - через outbox** в той же транзакции, что и `Paid`. Хендлеры не вызывают Ledger
   и Notifications (ADR-0006). Старый `PayInvoiceHandler` с прямым `ILedgerGateway` не
   переиспользуется и не расширяется.
4. **Wallet изолирован от котировок FX**: свой `HttpClient` с собственным конвейером устойчивости,
   лимит параллельных вызовов, бюджет подключений к БД меньше размера пула.
5. **Ночное задание работает на всех трёх репликах одновременно** - корректность держится на
   атомарном захвате счёта, а не на «выборе лидера». Реплики делят работу, а не дублируют её.

## 2. Домен

Один агрегат - `Invoice` (границы не расширяем). Попытка оплаты - часть счёта, отдельных сущностей и
репозитория для неё нет. Wallet и Customer в этой задаче агрегатами Billing не становятся.

Статусы: `Draft, Issued, PaymentPending, Paid, Cancelled` (`PaymentPending` добавляется).

Переходы - только методами `Invoice`, возвращающими `Result` с `InvoiceInvalidStateError` (ADR-0002):

| Метод | Из | В | Примечание |
|---|---|---|---|
| `BeginWalletPayment(at)` | `Issued` | `PaymentPending` | повторный вызов в `PaymentPending` - не ошибка для вызывающего, см. 3.1 |
| `CompleteWalletPayment(at)` | `PaymentPending` | `Paid` | ставит `PaidAt`; для уже `Paid` - идемпотентный no-op |
| `DeclineWalletPayment(reason, at)` | `PaymentPending` | `Issued` | только при окончательном отказе Wallet |
| `Cancel()` | `Issued`, `Draft` | `Cancelled` | из `PaymentPending` запрещён: иначе деньги списаны, а счёт отменён |

Старые `Issue/MarkPaid/Cancel` с безусловной записью статуса приводятся к той же дисциплине в рамках
правки (иначе `MarkPaid` старого `/pay` обходит `PaymentPending`; старый `/pay` проверяет
`Status == Issued` и поэтому в `PaymentPending` счёт не пропустит).

Хранимые поля добавляются только с читателем:

- `LastAutoPayAttemptOn: DateOnly?` - читатель: выборка ночного задания («сегодня ещё не пробовали»).
  Без него счёт с отказом перебирался бы каждый тик.
- `LastPaymentDeclineReason` (enum: `InsufficientFunds`, `WalletBlocked`, `CurrencyMismatch`) - читатель:
  `GET /invoices/{id}` (кабинет показывает причину после асинхронного отказа).
- Ключ идемпотентности **не хранится**: он выводится из `InvoiceId` (`billing-invoice-{id}-debit`).
  Счёт оплачивается один раз, одного ключа на счёт достаточно.
- Номер версии (конкурентность) - деталь персистентности (колонка/`xmin`), в модель не выносится.

Имена в домене - по смыслу, не по Wallet: `WalletPayment`/«оплата с баланса», `DeclineReason`; слова
`debit/credit` и формы ответа Wallet остаются в `Infrastructure/Wallet`.

Ошибки (наследники `BillingError`, ADR-0002): `InvoiceInvalidStateError` (существует),
`PaymentConcurrencyError` (`invoice.payment_conflict`, 409) на проигранную гонку без идемпотентного
ответа.

## 3. Application

Хендлеры в `Application/Handlers/Invoices/`, один `HandleAsync`, валидатор рядом (RUL-0003):

- `RequestWalletPaymentHandler` (`RequestWalletPaymentCommand(InvoiceId)`) - ручная оплата.
- `ProcessWalletPaymentHandler` - выполняет списание для счёта в `PaymentPending`.
- `ClaimInvoicesForAutoPayHandler` - ночной захват пачки счетов.

Порты в `Application/Abstractions/`:

- `IWalletGateway` - `Task<WalletWithdrawal> WithdrawAsync(CustomerId, Money, IdempotencyKey, ct)`.
  Результат - не исключение, а закрытый набор исходов:
  `Withdrawn | Declined(reason) | Unknown`. `Unknown` - таймаут, 5xx, обрыв, открытый breaker.
  Тип ключа - узкий `IdempotencyKey`, не `string`.
- `IInvoiceRepository` расширяется двумя узкими методами под единственные сценарии
  (specification для них не нужен - запросы простые и по одному разу):
  `ClaimDueForAutoPayAsync(DateOnly today, int batch, ct)` и `ListPendingPaymentAsync(int batch, ct)`.
  Существующий `ListByStatusAsync` для 40 тысяч счетов не используется (грузит всё).
- `IOutbox` - как есть; добавляются сообщения `ReceiptRequested(InvoiceId, CustomerId)` рядом с
  `LedgerPostingRequested`.
- Единица работы: репозиторий и outbox работают в одной транзакции Postgres (общий scoped
  `DbContext` - один контекст на единственный контекст Billing).

### 3.1 Ручная оплата

```
Кабинет -> POST /invoices/{id}/pay-from-wallet
  RequestWalletPaymentHandler:
    Find(id)                      -> нет: InvoiceNotFoundError (404)
    PaymentPending                -> 202 (идемпотентно, уже в работе)
    Paid                          -> 200/204 (уже оплачен)
    invoice.BeginWalletPayment()  -> не Issued: InvoiceInvalidStateError (409)
    Save (оптимистичная версия)   -> конфликт версий: перечитать; если теперь PaymentPending -> 202,
                                     иначе PaymentConflictError
  -> 202 Accepted { status: "PaymentPending" }  (enum строками, коммит 2ca40d4)
  сигнал воркеру через in-process Channel; воркер всё равно опрашивает БД раз в несколько секунд
Кабинет опрашивает GET /invoices/{id} (новый): status, paidAt, lastPaymentDeclineReason
```

### 3.2 Выполнение списания (`ProcessWalletPaymentHandler`)

```
для счёта в PaymentPending:
  r = wallet.WithdrawAsync(customer, amount, key = f(invoiceId))     # без транзакции БД и без блокировок
  Withdrawn: Транзакция { invoice.CompleteWalletPayment();
                          outbox += LedgerPostingRequested(ExternalId = "pay-{id}", ...);
                          outbox += ReceiptRequested }
  Declined:  invoice.DeclineWalletPayment(reason) -> Issued; Save
  Unknown:   ничего не меняем; счёт остаётся PaymentPending; повтор с тем же ключом позже
```

Почему это безопасно при сбоях:

- Падение процесса после ответа Wallet, до коммита: `PaymentPending` уже сохранён; повтор с тем же
  ключом вернёт прежний успех, завершаем `Paid`. Деньги не потеряны, второго списания нет.
- Два воркера (две реплики) взяли один счёт: оба шлют один ключ - Wallet отвечает одним результатом;
  второй `CompleteWalletPayment` - no-op, outbox-сообщения второй транзакции не создаются (проверка
  состояния до записи). `ExternalId` проводки уникален на операцию (ADR-0006) - вторая линия защиты.
- `Unknown` никогда не трактуется как отказ. В `Issued` счёт возвращает только `Declined`.
- Обязательное условие, которого нет в задаче: срок хранения `Idempotency-Key` в Wallet. Повтор
  после его истечения дал бы второе списание (см. вопросы). До ответа: повторы ограничены
  `MaxPendingAge` (по умолчанию 12 ч), по превышению - алерт и ручная сверка, автоматического
  возврата в `Issued` нет.

Кредит (`POST .../credits`) этим потоком не используется: счёт нельзя отменить в `PaymentPending`,
значит ситуации «списали, а оплатить нельзя» нет. Компенсации возврата оплаченных счетов - вне задачи.

### 3.3 Повторы и расписание

Повторы неопределённого исхода делает воркер, а не конвейер HTTP: backoff 30 с -> 1 мин -> 5 мин ->
15 мин (потолок), с джиттером. Счета берутся в порядке `PaymentRequestedAt`. Для перезапуска
после падения воркера счёт `PaymentPending` без актуальной «аренды» (колонка `LeaseUntil`, чисто
инфраструктурная, пишется методом `ListPendingPaymentAsync`, читается им же) подбирается другой
репликой. Аренда - оптимизация против дублей; корректность от неё не зависит (идемпотентный ключ).

## 4. Хранение

Postgres (BILL-34 - предварительное условие: `InMemoryStore` не даёт транзакции «счёт + outbox»).

- `invoices`: существующие поля + `status` (текстом), `last_auto_pay_attempt_on`,
  `last_payment_decline_reason`, `payment_requested_at`, `lease_until`, `version`.
  Индексы: частичный по `status = 'Issued'` на `(due_date)` для ночной выборки; частичный по
  `status = 'PaymentPending'` для воркера. `payment_requested_at` читает воркер (порядок, `MaxPendingAge`).
- `customer_autopay` (`customer_id`, `enabled`) - флаг автосписания. Источник правды - открытый
  вопрос (п. 8); пока предлагается хранить в Billing; это отдельная таблица, не часть `Invoice`,
  в выборке читается join-ом, в транзакции с счётом не меняется.
- `outbox`: общая таблица (`id`, `type`, `payload`, `created_at`, `sent_at`, `attempts`,
  `next_attempt_at`), пишется в одной транзакции с `invoices`.

## 5. Outbox: Ledger и Notifications

Диспетчеры раздельные, чтобы медленный/упавший получатель не блокировал другого. Нынешний
`LedgerOutboxDispatcher` останавливает весь тик на первой ошибке - это допустимо для Ledger, но
общий диспетчер сделал бы Notifications способным задерживать проводки.

- **Ledger** (критично): как в ADR-0006; перенос чтения на Postgres с `FOR UPDATE SKIP LOCKED` (три
  реплики), повтор до успеха. Недоступность Ledger не влияет на `Paid`.
- **Notifications** (некритично): свой `ReceiptOutboxDispatcher`; ограниченные повторы
  (по умолчанию 10 попыток по backoff, затем сообщение помечается отброшенным, `LogWarning`).
  Идемпотентность чека - ключ `receipt-{invoiceId}`; если Notifications не поддерживает ключ, дубль
  чека допустим, потеря - тоже. Статус счёта и проводка от чека не зависят никогда.
- Клиенты Ledger/Notifications и Wallet регистрируются как типизированные клиенты с
  `AddStandardResilienceHandler()` (ADR-0007), `AddPolicyHandler` не используется.

## 6. Wallet: устойчивость и изоляция от FX

Стандартный обработчик по умолчанию рвёт попытку на ~10 с, что короче легитимных 30-40 с Wallet -
таймауты **обязательно** переопределяются:

| Параметр | Значение (старт, настраивается `Wallet:*`) | Зачем |
|---|---|---|
| Таймаут попытки | 60 с | выше 40 с пика, иначе валидные ответы режутся и плодят повторы |
| Повторы в конвейере | 1 (только идемпотентный `POST` с ключом, безопасно) | остальное делает воркер |
| Общий таймаут запроса | 150 с | |
| Circuit breaker | окно выборки не меньше 2x таймаута попытки; открытие при доле отказов > 50% и минимуме запросов | 3-5-минутный релиз Wallet |
| Параллельных вызовов Wallet на реплику | 16 (семафор в воркере) | не исчерпать сокеты/пул |

- Отдельные `HttpClient` и `SocketsHttpHandler` с `MaxConnectionsPerServer`; общего handler с
  `FxRatesClient` нет. Вызовы полностью `async` - потоки не блокируются, котировки не страдают от
  медленного Wallet.
- Пока breaker открыт или идёт «ночное окно» без ёмкости, воркер **не захватывает новые** счета и
  не штормит; пачка `PaymentPending` ждёт backoff.
- Ручные оплаты имеют приоритет над ночными: воркер сначала берёт `PaymentPending` с ручным
  источником (отдельный семафор на 4 слота внутри общих 16).
- Лимит соединений к Postgres воркерами (параллелизм + захват пачек) держится заметно ниже размера пула,
  чтобы `/quote` не ждал соединения.
- `FxRatesClient` остаётся как есть (ADR-0005 про справочники; Wallet - не справочник, синхронного
  вызова «в момент операции» здесь нет). `FxModule` переводится на ADR-0007 только при его правке.

## 7. Ночное автосписание

`AutoPayWorker` - `BackgroundService` на каждой реплике (как сейчас: «на каждой реплике»), без
лидера и без distributed lock.

```
каждые ~10 с, пока now в окне AutoPay:Window (часовой пояс бизнеса, не UTC):
  если breaker Wallet открыт или свободной ёмкости нет - пропустить тик
  ClaimInvoicesForAutoPayHandler:
    короткая транзакция:
      SELECT ... FROM invoices i JOIN customer_autopay a
      WHERE i.status = 'Issued' AND i.due_date <= today AND a.enabled
        AND (i.last_auto_pay_attempt_on IS DISTINCT FROM today)
      ORDER BY customer_id, due_date  LIMIT batch  FOR UPDATE OF i SKIP LOCKED
      для каждого: invoice.BeginWalletPayment(); invoice.MarkAutoPayAttempted(today)
      Save; commit
  -> захваченные счета обрабатывает общий путь 3.2
```

- Переход делает метод агрегата, не массовый `UPDATE ... SET status` (иначе обход инварианта).
  `SKIP LOCKED` + проверка статуса гарантируют, что реплики и ручной клик не возьмут один счёт.
- Захват порциями (batch ~ ёмкость воркера x 2), не всех 40 тысяч сразу: иначе клиенты неделями
  видели бы «в обработке» на ещё не тронутых счетах, а `Cancel` был бы заблокирован массово.
- Порядок - по клиенту: счета одного клиента с ограниченным балансом обрабатываются последовательно,
  иначе исход зависит от гонки.
- Отказ (`Declined`) за ночь не повторяется: `LastAutoPayAttemptOn = today`. Следующая попытка -
  следующей ночью. Неопределённые исходы доводит воркер, не селектор.
- Ёмкость (оценка): 40 000 x задержка / (3 реплики x 16 слотов). При 2 с - ~28 мин; при 30 с - ~7 ч
  (не влезет в 6-часовое окно). Поэтому: недозахваченные счета остаются `Issued` и забираются
  следующей ночью/следующим тиком, пока окно открыто; темп согласовать с Payments (п. 8).
- Гонка «клиент жмёт оплатить в ту же минуту»: оба идут через `BeginWalletPayment` + версия; проигравший
  получает 202 (уже в работе) или 409; в Wallet уходит один ключ.
- Перезапуск реплики посреди ночи ничего не ломает: состояние в БД.

## 8. Открытые вопросы (нужны ответы до реализации)

1. **Payments:** срок хранения `Idempotency-Key`; как различить «отказ» и «ошибка» в кодах ответа
   (нужно для `Declined` vs `Unknown`); есть ли чтение операции по ключу; допустимый RPS ночью;
   валюта баланса против валюты счёта (пока `CurrencyMismatch` = отказ, конвертации нет).
2. **Владелец флага автосписания** и способ его включения (в задаче ручек нет).
3. **Notifications:** контракт, идемпотентность, лимиты.
4. Часовой пояс «срока, который наступил» и границы ночного окна.
5. Ледгер-долг `PayInvoiceHandler` (ADR-0006) решается отдельной задачей; BILL-41 его не трогает.

## 9. Что меняется и в каких файлах

Только перечень, без кода:

- `Domain/Invoice.cs` - статус `PaymentPending`, методы переходов, два новых поля; `Domain/Errors.cs` -
  `PaymentConcurrencyError`.
- `Application/Abstractions/` - `IWalletGateway`, расширение `IInvoiceRepository`.
- `Application/Handlers/Invoices/` - три хендлера (+ валидатор команды рядом, RUL-0003).
- `Application/Messages/ReceiptRequested.cs`.
- `Api/InvoiceEndpoints.cs` - `POST /{id}/pay-from-wallet`, `GET /{id}`.
- `Infrastructure/Wallet/` - клиент, опции, адаптер `IWalletGateway`; `Infrastructure/Persistence/` -
  Postgres-репозиторий и outbox (BILL-34); `Infrastructure/Notifications/` - клиент и диспетчер.
- `Modules/` - `WalletModule`, `NotificationsModule`; `Billing.Api.csproj` -
  `Microsoft.Extensions.Http.Resilience`.
- Новый ADR (0008): «Оплата с Wallet - асинхронно, идемпотентный ключ на счёт, неопределённый исход
  не освобождает счёт». Структура решения остаётся одним проектом со срезом по сценарию внутри
  существующих папок; общих `Shared/Common` проектов не вводится.
- Тесты задачей не требуются (RUL-0002); логика переходов и исходов при этом лежит в `Invoice` и
  хендлерах за портами и проверяется без HTTP.
