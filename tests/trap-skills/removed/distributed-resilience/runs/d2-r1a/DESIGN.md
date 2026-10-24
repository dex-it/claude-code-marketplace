# DESIGN: BILL-41 - оплата счёта с баланса Wallet

Статус: Proposed. После согласования оформить как ADR-0008. Код в этом документе не пишется.

## 1. Суть решения

Wallet - внешняя система со своей БД, одной транзакции с Postgres Billing нет. Поэтому оплата - это
**персистентная машина состояний в агрегате `Invoice`** плюс **детерминированный Idempotency-Key**:

1. Сначала в коротком локальном tx фиксируем намерение: `Issued -> PaymentPending`, номер попытки.
2. Потом, без открытой транзакции, вызываем Wallet с ключом, выводимым из счёта и номера попытки.
3. Потом в одном tx: `PaymentPending -> Paid` + проводка Ledger + чек (всё через outbox).

Любой сбой между шагами 1 и 3 оставляет счёт в `PaymentPending`. Фоновое восстановление повторяет
вызов **с тем же ключом**; Wallet вернёт прежний результат. Двойное списание исключено ключом, а не
блокировкой или таймингом. Потеря денег (списано, но счёт не `Paid`) исключена тем, что намерение и
ключ записаны до вызова, а `PaymentPending` рано или поздно доводится до конца.

Ручная и автоматическая оплата - один и тот же путь (`WalletPaymentExecutor`, см. п. 3); различаются
только тем, кто берёт счёт в работу и сколько ждёт ответа.

## 2. Домен (агрегат Invoice)

Один агрегат, второго не вводится; одна транзакция меняет только `Invoice` и строки outbox (outbox не
агрегат). Wallet и баланс клиента в доменную модель не входят - это внешний контекст, баланс Billing
не хранит.

Новое состояние: `InvoiceStatus.PaymentPending`. Переходы - только методами `Invoice`, не присваиванием
в хендлере:

| Метод | Переход | Инвариант |
|---|---|---|
| `BeginPayment(now, leaseUntil)` | `Issued -> PaymentPending` | `PaymentAttempt++`, запоминает срок аренды |
| `ResumePayment(now, leaseUntil)` | `PaymentPending -> PaymentPending` | только при истёкшей аренде; номер попытки тот же |
| `CompletePayment(at)` | `PaymentPending -> Paid` | `PaidAt`, `PaidVia = Wallet` |
| `DeclinePayment(today)` | `PaymentPending -> Issued` | запоминает `LastDeclinedOn`; следующая попытка получит новый ключ |

Нарушение переходов - `InvoiceInvalidStateError` (ADR-0002). Существующие публичные `MarkPaid` и
`Cancel` позволяют переход из любого состояния; для нового пути не используются, а `Cancel` в
`PaymentPending` отвергается проверкой статуса в `CancelInvoiceHandler` (он уже допускает только
`Issued`/`Paid`). Ужесточить `MarkPaid`/`Cancel` - отдельной правкой.

Хранимые поля добавляются только с читателем:

| Поле | Читатель |
|---|---|
| `PaymentAttempt` (int) | ключ Wallet и `ExternalId` попытки |
| `PaymentLeaseUntil` | восстановление и ручная кнопка при чужой аренде |
| `LastDeclinedOn` (DateOnly?) | выбор для ночного задания (не повторять отказ в ту же ночь) |
| `PaidVia` | `CancelInvoiceHandler` (см. п. 8, вопрос 2) |
| `Version` | оптимистичная конкуренция |

Ключ Wallet **не хранится**, он выводится: `billing-pay-{InvoiceId}-{PaymentAttempt}` (строится в
Infrastructure-клиенте; слово «Idempotency-Key» и формы Wallet API в Domain/Application не
попадают - там `PaymentReference`). Новый номер попытки нужен после явного отказа: Wallet на повтор
ключа вернёт прежний отказ, и без нового ключа счёт никогда не оплатится.

Автосписание включено у клиента: Billing такого признака пока не хранит (в коде нет). Предлагается
таблица `customer_payment_settings(customer_id pk, auto_debit_enabled)`; источник и владелец
значения - вопрос 1.

## 3. Структура и слои (одна сборка, срез по фиче, как сейчас)

Новых проектов и Shared нет; зависимости как сейчас: Infrastructure -> Application -> Domain.

- `Domain/`: `Invoice` (новые методы), `PaymentReference`, ошибки `WalletDeclinedError`
  (`wallet.declined`, с причиной в сообщении), `PaymentOutcome` (Paid/Pending).
- `Application/Abstractions/`: `IWalletGateway` -
  `DebitAsync(CustomerId, Money, PaymentReference, ct) -> WalletDebitResult`, где результат ровно из
  трёх значений: `Succeeded`, `Declined(reason)` (однозначный отказ: недостаточно средств, счёт
  заблокирован), `Unknown` (таймаут, 5xx, разомкнутый breaker, отмена). Разбор HTTP-кодов - в
  Infrastructure. Расширяется `IInvoiceRepository`: `ClaimDueForAutoDebitAsync(batchSize, now, leaseUntil)`
  и `ClaimExpiredLeasesAsync(batchSize, now, leaseUntil)` - атомарные захваты (п. 5); `SaveAsync`
  бросает/возвращает конфликт версии. Specification не вводим: запросы простые, два узких метода
  нужны ради `FOR UPDATE SKIP LOCKED`.
- `Application/Handlers/Invoices/` (RUL-0003):
  - `PayInvoiceFromWalletHandler.HandleAsync(PayInvoiceFromWalletCommand, ct)` - ручная оплата;
  - `AutoDebitInvoicesHandler.HandleAsync(AutoDebitInvoicesCommand, ct)` - один захват пачки и её
    обработка (вызывается воркером в цикле);
  - `RecoverPendingPaymentsHandler.HandleAsync(...)` - повтор для `PaymentPending` с истёкшей арендой.
  - Общая логика шагов 2-3 - `Application/Payments/WalletPaymentExecutor` (не хендлер; хендлеры не
    вызывают друг друга). Исполнитель тестируется без HTTP: фейки `IWalletGateway`,
    `IInvoiceRepository`, `IOutbox`. Тесты в задаче не требуются (RUL-0002), но рекомендуются на
    сценарии п. 4.
  - Валидатор для команд не нужен: входной параметр - только id.
- `Application/Messages/`: `LedgerPostingRequested` (есть), `ReceiptRequested(InvoiceId, CustomerId, Money)`.
- `Infrastructure/Wallet/`: `WalletClient`, `WalletOptions`; `Infrastructure/Notifications/`:
  `NotificationsClient`, `ReceiptOutboxDispatcher`; `Infrastructure/Payments/AutoDebitWorker`,
  `PendingPaymentsRecoveryWorker`; `Modules/WalletModule.cs`, `Modules/NotificationsModule.cs`.
- Api: `POST /invoices/{id}/pay-from-wallet` в `InvoiceEndpoints`.

Старый `PayInvoiceHandler` (прямой вызов `ILedgerGateway`, ADR-0006) не трогаем; он требует `Issued`,
поэтому не может пересечься со счётом в `PaymentPending`. Новый код `ILedgerGateway` не использует.

## 4. Последовательность оплаты

Общий исполнитель для счёта, **уже захваченного** вызывающим (статус `PaymentPending`, аренда на нём):

1. `ref = PaymentReference(InvoiceId, PaymentAttempt)`.
2. `IWalletGateway.DebitAsync(customer, invoice.Amount, ref, ct)` - без tx и без соединения с БД.
   Сумма - `Money` в минорных единицах (ADR-0004), конвертации нет.
3. Исход:
   - `Succeeded`: один tx - `invoice.CompletePayment(now)`; в outbox `LedgerPostingRequested`
     (`ExternalId = pay-{InvoiceId}`, ADR-0006) и `ReceiptRequested`; commit с проверкой `Version`.
   - `Declined`: `invoice.DeclinePayment(today)`, `Issued`; ручной вызов получает `wallet.declined`.
   - `Unknown`: ничего не меняем; счёт остаётся `PaymentPending`, аренда истечёт - подберёт
     восстановление. Ручной вызов получает `Pending`.
4. Если на шаге 3 `Succeeded` падает commit (конфликт версии/БД/падение процесса) - счёт остаётся
   `PaymentPending`, восстановление повторяет шаг 2 с тем же ключом, Wallet вернёт прежний успех, шаг 3
   завершится. Деньги не теряются и не списываются повторно.

### Ручная оплата
`POST /invoices/{id}/pay-from-wallet`, без тела:
1. Найти счёт: нет - `invoice.not_found` (404).
2. Статус `Issued` - `BeginPayment`, сохранить (оптимистично) и выполнить исполнитель. Статус
   `PaymentPending`: аренда жива - вернуть `Pending`, ничего не вызывая (параллельное автосписание
   или повторный клик); аренда истекла - `ResumePayment` и выполнить исполнитель с тем же ключом.
   Прочие статусы (в т.ч. `Paid`) - `invoice.invalid_state` (409). Повторный клик по уже оплаченному
   возвращает 409; клиент трактует как «уже оплачено».
3. Ожидание ограничено 10 с (`CancellationTokenSource` с таймаутом, связанный с токеном запроса):
   вызов Wallet из личного кабинета не висит 40 с. Отмена локального ожидания - это `Unknown`, а не
   откат: Wallet мог списать.
4. Ответы: 200 `{status: "paid"}`; 202 `{status: "pending"}` (фронт показывает «платёж
   обрабатывается» и обновляет страницу); 422 `wallet.declined`; 409 `invoice.invalid_state`;
   конфликт версии при Begin - перечитать и действовать по текущему статусу (не 500).

### Гонка «ручная кнопка» против автосписания
Обе стороны входят через условный захват `Issued -> PaymentPending` с проверкой `Version`
(для ночной пачки - `FOR UPDATE SKIP LOCKED`). Захватить может ровно один; проигравший видит
`PaymentPending` и возвращает `Pending` без вызова Wallet. Даже если из-за истёкшей аренды вызов
повторят оба, ключ у них одинаковый (то же `PaymentAttempt`) - Wallet спишет один раз. Безопасность
держится на ключе; аренда - только оптимизация, чтобы не слать лишних вызовов.

## 5. Ночное задание

Запускается на каждой из трёх реплик (как сейчас) - **корректность от этого не зависит**, лидер не
нужен. Работа делится через БД:

1. Воркер раз в тик (в окно ночи, настраивается) забирает пачку: в одном коротком tx
   `SELECT ... WHERE status='Issued' AND due_date <= today AND auto_debit_enabled AND
   (last_declined_on IS NULL OR last_declined_on < today) ORDER BY due_date, id LIMIT N
   FOR UPDATE SKIP LOCKED`, для каждого `BeginPayment(now, now + lease)`, commit. Реплики забирают
   непересекающиеся пачки.
2. Пачку обрабатывает исполнитель с ограниченным параллелизмом (`SemaphoreSlim`, по умолчанию 16 на
   реплику, итого ≤ 48 на Wallet - согласовать с командой Payments, вопрос 3). tx и соединение с БД
   на время вызова Wallet не держатся.
3. Размер пачки равен параллелизму: не берём в аренду больше, чем успеем обработать, иначе аренды
   истекают в очереди.
4. Аренда (`lease`) - 5 минут: больше таймаута вызова с ретраями. Просроченные аренды подбирает
   `PendingPaymentsRecoveryWorker` (то же `SKIP LOCKED`, `ResumePayment`, исполнитель, тот же ключ).
5. Окно: задание останавливается к заданному часу (по умолчанию 06:00 UTC); необработанные счета
   остаются `Issued` и забираются на следующем тике/ночи - срок оплаты уже наступил, они подпадают
   под выборку снова. Пик месяца ничего не ломает, лишь растягивается.
6. Отказанные (`Declined`) в ту же ночь не повторяются (`LastDeclinedOn`); в следующую - получают
   новый ключ.
7. Автосписание не ловит счета, у которых `PaymentPending` с живой арендой.

Оценка: 40 тыс. при 48 параллельных и норме ~0,5 с - около 7 минут; при деградации Wallet до 30 с -
около 7 часов, поэтому окно и breaker (п. 6) обязательны.

## 6. Поведение при сбоях и медленных ответах

Принцип: ожидание Wallet не должно ничего занимать, кроме самого вызова; недоступность Wallet
переводит оплаты в `PaymentPending`/«не взято», но не ломает остальной Billing.

**Wallet** (до 40 с, 3-5 мин в релиз, до 30 мин при инциденте):
- Отдельный типизированный `WalletClient` на `AddStandardResilienceHandler` (ADR-0007; `AddPolicyHandler`
  не использовать), свои настройки: таймаут попытки 45 с, общий таймаут 2 мин, повторы ≤ 2 с
  `UseJitter = true`, circuit breaker. Повтор POST допустим именно потому, что есть Idempotency-Key.
  Ключ добавляется на уровне запроса и неизменен между повторами.
- Релиз 3-5 мин: breaker размыкается; воркер перестаёт забирать новые пачки (проверка состояния
  breaker/health Wallet перед захватом); уже захваченные - `Unknown`, `PaymentPending`.
- Инцидент до 30 мин: то же; восстановление повторяет по истечении аренды.
- **Восстановление после простоя без шторма**: воркеры возобновляются с случайной задержкой
  (джиттер) и «медленным стартом» (параллелизм растёт ступенями до лимита), три реплики не стартуют
  синхронно. Повторы подхваченных `PaymentPending` тоже растягиваются по времени случайным сдвигом
  аренды, а не выходят одной волной.
- Защита от протухшего ключа: если Wallet хранит ключи ограниченное время (вопрос 4), счёт в
  `PaymentPending` старше этого срока автоматически не повторяется - алерт и ручной разбор, чтобы
  повтор не превратился в двойное списание.

**Котировки (`/quote`, FX) не должны страдать от ночной оплаты:**
- Wallet и FX - разные `HttpClient` и разные конвейеры устойчивости, пулы соединений и breaker'ы не
  общие; `FxRatesClient` не меняется (остаётся на своих политиках до своей правки, ADR-0007).
- Параллелизм воркера ограничен семафором (bulkhead), а не `Task.WhenAll` по всей пачке, поэтому
  потоки/соединения не вычерпываются; вызовы полностью асинхронные.
- Соединение с БД не удерживается во время вызова Wallet; захват пачки - короткий tx. Доля пула
  соединений воркера ограничена параллелизмом (16 < размера пула, оставить запас на HTTP-запросы).
- Общий ключ здоровья не вводится: Wallet не входит в readiness (см. п. 7), его недоступность не
  выводит реплики из балансировки.

**Ledger** (ADR-0006): проводка лежит в outbox в том же tx, что `Paid`; недоступность Ledger не
влияет на оплату, диспетчер повторяет. Обязательные условия к диспетчеру перед этой задачей: outbox
переезжает из `InMemoryStore` в таблицу Postgres (иначе `Paid` и outbox не в одном tx, а на трёх
репликах сообщения теряются); выборка неотправленных - `FOR UPDATE SKIP LOCKED` (три реплики не
шлют одно и то же дважды; а повтор безвреден благодаря уникальному `ExternalId`).

**Notifications** (чек некритичен): чек - сообщение `ReceiptRequested` в том же outbox, отправляет
отдельный `ReceiptOutboxDispatcher` со своим клиентом (короткие таймауты, 2-3 повтора с джиттером,
после чего сообщение помечается `Failed` и пропускается). Медленный или упавший Notifications не
замедляет Ledger-диспетчер и не влияет на оплату. Возможный дубль чека при повторе принимается
(at-least-once, ключ - `InvoiceId`).

**Рост 10× (400 тыс. счетов в ночь):** первым ограничивается Wallet; растёт время, а не отказы -
окно и backlog видны метрикой. Вертикальный предел - параллелизм на Wallet (п. 5); масштабирование
горизонтальное добавлением реплик само не увеличивает нагрузку выше глобального лимита, если лимит
на реплику пересчитывается. Узкое место БД - индексы ниже, пачки по 16.

Деградация: Wallet недоступен - ручная оплата отвечает 202/«обрабатывается» быстро (не позже 10 с, при
разомкнутом breaker - сразу), ночная пауза без потери; все остальные операции Billing, включая
котировки, работают.

## 7. Хранилище и индексы (Postgres, BILL-34)

`invoices` (колонки к существующим): `status` (+`PaymentPending`), `version int`,
`payment_attempt int not null default 0`, `payment_lease_until timestamptz null`,
`last_declined_on date null`, `paid_via text null`.
- Частичный индекс `(due_date, id) WHERE status = 'Issued'` - выборка автосписания;
- Частичный индекс `(payment_lease_until) WHERE status = 'PaymentPending'` - восстановление; он
  малый по размеру (в норме почти пуст).
- Конкуренция: условное обновление `WHERE id = @id AND version = @version`.

`customer_payment_settings(customer_id pk, auto_debit_enabled bool)` - выборка соединяет по pk.

`outbox(id uuid pk, type text, dedupe_key text, payload jsonb, created_at, attempts int,
next_attempt_at, sent_at null, failed_at null)`, `unique (type, dedupe_key)` - защита от дубля
сообщений на один счёт (`dedupe_key` = `pay-{InvoiceId}` / `receipt-{InvoiceId}`); частичный индекс
`(type, next_attempt_at) WHERE sent_at IS NULL AND failed_at IS NULL`.

Обоснование ключей: оплата ищется только по `status`+срок и по аренде, поэтому индексы частичные и не
раздуваются оплаченными счетами; уникальность outbox - второй рубеж от дубля проводки.

## 8. API и контракты

- `POST /invoices/{id}/pay-from-wallet`: тело пустое; идемпотентна по построению (повтор - либо
  `pending`, либо 409 `invoice.invalid_state` после оплаты). Клиентский `Idempotency-Key` не нужен:
  идемпотентность задаёт состояние счёта. Коды: 200, 202, 404 `invoice.not_found`, 409
  `invoice.invalid_state`, 422 `wallet.declined`. Ошибки - через `ResultHttpExtensions` (новый тип
  `WalletDeclinedError` - в маппинг). Enum в JSON - строками (контракт с фронтом, коммит 2ca40d4);
  `PaymentPending` - новое значение для фронта, согласовать отображение.
- Wallet `POST /wallets/{customerId}/debits`: заголовок `Idempotency-Key`; сумма в минорных единицах
  и валюта (расхождение валюты счёта и баланса - вопрос 5).
- События (внутренние, outbox): `LedgerPostingRequested`, `ReceiptRequested`.

## 9. Наблюдаемость

Метрики: `billing_wallet_debit_seconds` (гистограмма, label `outcome`: succeeded/declined/unknown);
`billing_payments_pending` (gauge) и `billing_payments_pending_oldest_age_seconds` (алерт > 15 мин и
> срока ключа Wallet); `billing_autodebit_backlog` (due и не оплачено), `billing_autodebit_batch_*`;
состояние breaker Wallet; `billing_outbox_lag_seconds{type}`, число `Failed` чеков; доля 202 на
ручной оплате.
Логи: `ILogger<T>` со структурными полями `InvoiceId`, `PaymentAttempt`, `Outcome`, `Replica`;
ключ идемпотентности логируется, суммы - нет в лишних местах (RUL-0004 пока Proposed, следуем ему).
Трассировка: спан на захват, на вызов Wallet, на commit; trace-id идёт в исходящих заголовках.
Probes: liveness - процесс жив; readiness - Postgres доступен. Wallet, Ledger, Notifications и FX в
readiness **не входят**: их недоступность не должна выводить реплику из балансировки и ломать
котировки. Воркеры публикуют время последнего успешного тика (алерт «ночное задание молчит»).

## 10. Рассмотренное и отвергнутое

- Вызов Wallet внутри открытого tx/`FOR UPDATE`: держит соединение до 40 с, шторм таймаутов пула,
  заденет котировки.
- Списать и сразу `Paid` без `PaymentPending`: падение между шагами теряет след списания.
- Ключ идемпотентности случайный на каждую попытку: повтор после таймаута спишет второй раз.
- Лидер ночного задания (advisory lock, отдельный деплой): лишняя точка отказа; `SKIP LOCKED` проще.
- Синхронный чек или проводка в хендлере: нарушает ADR-0006 и привязывает оплату к соседу.
- Кэш/вызов баланса перед списанием («проверить, хватит ли»): гонка, не заменяет ключ.

## 11. Открытые вопросы

1. Где живёт «автосписание включено» и кто его владелец (Billing, Customers, Wallet)?
2. Отмена счёта, оплаченного с Wallet: сейчас `CancelInvoiceHandler` создаёт обратную проводку в
   Ledger, но деньги в Wallet не возвращает (нужен `credits` с ключом `refund-{InvoiceId}`).
   Рекомендация: до отдельной задачи на возврат запретить отмену при `PaidVia = Wallet`
   (`invoice.invalid_state`). Подтвердить с продуктом.
3. Допустимая суммарная нагрузка на Wallet (лимит параллельных вызовов) от команды Payments.
4. Срок хранения Idempotency-Key в Wallet и есть ли у Wallet чтение операции по ключу.
5. Валюта счёта и валюта баланса: ADR-0005/0004 покрывают только курс FX для котировок; считаем, что
   списание в валюте счёта, расхождение - отказ `wallet.declined`.
6. Часовой пояс/час окна ночного задания и «срок наступил» (`DueDate <= today` в UTC или в зоне клиента).
