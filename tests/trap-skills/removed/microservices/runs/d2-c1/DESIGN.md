# DESIGN: BILL-41 - оплата счёта с баланса Wallet

Статус: предложение. После согласования оформить как `docs/adr/0008-wallet-payments.md` (ADR-0001).

## 1. Ключевые решения

1. **Одна запись об оплате на счёт** - таблица `wallet_payments` в Postgres Billing с `UNIQUE(invoice_id)`.
   Ручная оплата и автосписание работают с одной и той же записью, поэтому двойное списание из-за гонки
   кабинета и ночного задания невозможно по построению.
2. **Идемпотентность на стороне Wallet.** Ключ `Idempotency-Key` детерминирован: `bill-{invoiceId}-{attemptNo}`.
   Он не зависит от реплики, процесса и повтора HTTP. `attemptNo` растёт только после *окончательного отказа*
   Wallet (иначе Wallet вернул бы прежний отказ по тому же ключу).
3. **Таймаут или 5xx - не отказ.** Исход списания неизвестен, запись остаётся `Debiting`, и мы повторяем тот же
   запрос с тем же ключом, пока не получим окончательный ответ. «Откатить» неизвестное списание нельзя.
4. **HTTP-вызов Wallet - вне транзакции БД и без удержания соединения Postgres.** Шаги: коротко
   зафиксировать намерение, вызвать Wallet, коротко зафиксировать результат.
5. **Результат фиксируется одной транзакцией:** `wallet_payments -> Completed`, `Invoice -> Paid`,
   `LedgerPostingRequested` и `ReceiptRequested` в outbox (ADR-0006). Ledger и Notifications на путь оплаты не влияют.
6. **Изоляция от котировок.** Wallet - отдельный `HttpClient` со своим конвейером устойчивости и лимитом
   параллелизма; ночное задание живёт в отдельной роли (воркер), не в API-репликах.

## 2. Данные

Таблица `wallet_payments` (одна строка на счёт):

| Поле | Назначение |
|---|---|
| `id`, `invoice_id` (UNIQUE), `customer_id` | ключи |
| `amount_minor`, `currency` | копия суммы счёта на момент попытки (ADR-0004) |
| `status` | `Debiting` / `Completed` / `Declined` |
| `attempt_no` | номер попытки; входит в ключ идемпотентности |
| `source` | `Manual` / `Auto` |
| `lease_until`, `lease_owner` | аренда строки обработчиком |
| `next_attempt_at`, `sent_count` | расписание повторов; `sent_count = 0` - запрос в Wallet ещё не уходил |
| `wallet_operation_id` | id операции из ответа Wallet (для сверки) |
| `decline_code`, `last_error` | причина отказа / последняя ошибка |
| `created_at`, `updated_at`, `completed_at` | аудит |

Другие изменения:

- `Invoice` остаётся со статусами `Draft/Issued/Paid/Cancelled`. Новый статус не вводим: он ломает
  контракт enum-строк с фронтом. «В обработке» - это `wallet_payments.status = Debiting`, наружу идёт через
  статус-ресурс (п. 3).
- Признак автосписания клиента: в `Invoice` его нет. Нужен `customer_settings.autopay_enabled` в Postgres Billing
  или другой источник - см. вопросы. Запрос ночного задания читает его JOIN-ом, не вызовом по счёту.
- Outbox должен писаться в той же транзакции Postgres, что и счёт (ADR-0006). Для этого нужна единица работы
  поверх `IInvoiceRepository` и `IOutbox` (сейчас `InMemory*`; зависимость от BILL-34).
- Блокировка счёта: `IInvoiceRepository` получает метод чтения `FOR UPDATE` (в границе короткой транзакции).

## 3. Ручная оплата: `POST /invoices/{id}/pay-from-wallet`

Последовательность (`PayInvoiceFromWalletHandler`, `Application/Handlers/Invoices/`, RUL-0003):

1. **Tx A (короткая):** `SELECT invoice FOR UPDATE`.
   - нет счёта -> `InvoiceNotFoundError`;
   - есть `wallet_payments.Completed` -> успех (идемпотентно, 204);
   - есть `Debiting` -> не создавать новую, перейти к шагу 5 (ждать/вернуть 202);
   - статус не `Issued` -> `InvoiceInvalidStateError`;
   - иначе вставить/переоткрыть строку: `Debiting`, `attempt_no` (+1 после `Declined`), аренда на себя. Commit.
2. **Вызов Wallet** `POST /wallets/{customerId}/debits` с `Idempotency-Key = bill-{invoiceId}-{attemptNo}`.
   Токен отмены - не токен HTTP-запроса, а собственный (обрыв клиента не должен бросать вызов на полпути;
   повтор всё равно безопасен благодаря ключу).
3. **Ответ 2xx:** Tx B - `Completed` + `invoice.MarkPaid` + два сообщения в outbox. Commit.
4. **Окончательный отказ (4xx, напр. недостаточно средств):** `Declined` + `decline_code`; наружу
   `WalletDeclinedError` (ADR-0002 - значение `Result`, не исключение; код `wallet.declined` / причина в `Message`).
5. **Неизвестный исход (таймаут, 5xx, обрыв):** строка остаётся `Debiting`, `next_attempt_at` по backoff.
   Эндпоинт ждёт завершения не дольше ~10 с (настройка); если не закончилось - **202 Accepted** со ссылкой на
   `GET /invoices/{id}/wallet-payment` (статус `Debiting/Completed/Declined`, строками). Фронт опрашивает.
   Дальше доводит фоновый обработчик (п. 5).
6. Исключение: если Wallet отвергнут **локально** (circuit breaker открыт, нет слота в лимите) и `sent_count = 0`,
   запрос точно не уходил - строку безопасно перевести в `Declined(wallet_unavailable)` и ответить
   `WalletUnavailableError` сразу, не заставляя пользователя ждать.

Старый `POST /invoices/{id}/pay` (`PayInvoiceHandler`, прямой вызов Ledger - долг по ADR-0006) не трогаем в
рамках задачи, но он должен брать ту же блокировку счёта и отказывать, если есть строка `wallet_payments`
(иначе два пути оплаты разойдутся). Малая правка в нём обязательна.

`CancelInvoiceHandler`: берёт `FOR UPDATE` счёта; при строке `Debiting` отвечает новой бизнес-ошибкой
`PaymentInProgressError`. Tx A и отмена сериализуются блокировкой, поэтому «деньги списаны, счёт отменён»
невозможно.

## 4. Автосписание (ночное задание)

Сейчас задания запускаются на каждой из трёх реплик. Решение: **корректность не зависит от числа
запускающих** (claim строк), а запускается оно **в отдельной роли** (тот же образ, флаг `Roles:AutoPay`, 1-2
экземпляра), чтобы ночная нагрузка не трогала API-реплики с котировками.

Две фазы, обе идемпотентны и возобновляемы:

1. **Постановка** (раз в минуту в окне, например 01:00-07:00 по бизнес-часовому поясу):
   `INSERT INTO wallet_payments ... SELECT ... FROM invoices i JOIN customer_settings s ... WHERE i.status = 'Issued'
   AND i.due_date <= today AND s.autopay_enabled AND нет строки / строка Declined с прошлой датой
   FOR UPDATE OF i SKIP LOCKED ON CONFLICT DO NOTHING`. Блокировка счёта - та же, что у ручной оплаты и отмены.
2. **Обработка:** воркеры берут пачки
   `UPDATE wallet_payments SET lease_until = now()+lease, lease_owner = @me WHERE id IN (SELECT id ... WHERE status='Debiting'
   AND next_attempt_at <= now() AND (lease_until IS NULL OR lease_until < now()) ORDER BY next_attempt_at
   FOR UPDATE SKIP LOCKED LIMIT @batch) RETURNING *`
   и дальше идут по шагам 2-5 из п. 3. Любая реплика/процесс может подобрать строку; упавшего владельца подменяет
   истечение аренды (аренда > полного таймаута запроса к Wallet), повтор безопасен из-за ключа.

Та же фаза 2 - **фоновая доводка** неизвестных исходов и для ручных платежей (`Debiting` с истёкшей арендой).

Пропускная способность: 40 тыс. счетов, задержка Wallet до 40 с. Параллелизм - конфиг
(`Wallet:AutoPayConcurrency`, старт 32 на экземпляр; по худшему случаю 40 000 x 40 с / 6 ч окна ~ 75 одновременных
запросов - нужно согласовать лимит с Payments). Если Wallet лежит - breaker открыт, задание простаивает и
продолжает сразу после восстановления; необработанные счета остаются `Issued` и подбираются в следующее окно.

Повторы отказов: `Declined` по недостатку средств при автосписании повторяется не чаще раза за ночь и не более N
раз на счёт (иначе спам и нагрузка) - N уточнить.

Приоритет ручной оплаты: отдельный резерв слотов лимита параллелизма (например 8 из 40), чтобы автосписание
не вытесняло пользователя в кабинете.

## 5. Поведение при сбоях

| Ситуация | Поведение |
|---|---|
| Wallet отвечает 30-40 с | Таймаут попытки > 40 с; пользователь через ~10 с получает 202; обработка продолжается в фоне |
| Wallet лежит 3-5 мин / до 30 мин | Breaker открывается; строки `Debiting` повторяются по backoff с тем же ключом; алерт при `Debiting` > 30 мин |
| Падение реплики между Wallet и Tx B | Строка `Debiting`, аренда истекает, другой обработчик повторяет тот же ключ, Wallet возвращает прежний результат, мы фиксируем `Completed` |
| Дубль запроса пользователя / кабинет + ночь | `UNIQUE(invoice_id)` + ключ; второй получает 202/204 по состоянию строки |
| Окончательный отказ Wallet | `Declined`, деньги не списаны, счёт `Issued` |
| Неизвестный исход дольше 24 ч | Эскалация на ручную сверку с Payments; автоматически не «проваливаем» и не откатываем |
| Ledger недоступен | Оплата не страдает: проводка в outbox, `LedgerOutboxDispatcher` повторяет; `ExternalId = pay-{invoiceId}` (тот же, что у старого пути - дедупликация в Ledger). Алерт на возраст неотправленных сообщений |
| Notifications медленный/недоступен | Чек - отдельное outbox-сообщение `ReceiptRequested`, ограниченное число повторов и TTL, потом отбрасывается с логом; на статус и деньги не влияет |
| Postgres недоступен | Tx A не прошла - в Wallet ничего не уходило; Tx B не прошла после списания - строка остаётся `Debiting`, доводка (повтор по ключу) |

## 6. Изоляция от котировок

Котировки (`/quote` + FX, ADR-0005) критичны. Защита:

- `WalletClient` - свой `AddHttpClient<WalletClient>` + `.AddStandardResilienceHandler()` (ADR-0007; `AddPolicyHandler`
  не используем). Настройки: `AttemptTimeout` ~45 с, `TotalRequestTimeout` ~2 мин, `CircuitBreaker.SamplingDuration`
  не меньше 2x таймаута попытки (требование валидации), ретраи с backoff. Повтор POST допустим только потому, что
  у каждого запроса есть ключ идемпотентности.
- Breaker, connection pool и лимит параллелизма Wallet независимы от FX.
- Соединение с Postgres не держится во время вызова Wallet; пул не расходуется на ожидание.
- Ночной воркер - отдельная роль; нагрузка и подбор строк не влияют на реплики API.
- `FxRatesClient` не меняем (остаётся на Polly до своей правки, ADR-0007).

## 7. Структура кода (без реализации)

- `Application/Abstractions/IWalletGateway.cs` (debit/credit с ключом), `IWalletPaymentRepository.cs`, единица работы.
- `Application/Handlers/Invoices/PayInvoiceFromWalletHandler.cs` + (при необходимости) валидатор рядом;
  `AutoPayDueInvoicesHandler` / исполнитель попытки (общий код шагов 2-5).
- `Domain`: `WalletPayment` (состояния, переходы), новые `BillingError`: `WalletDeclinedError`,
  `WalletUnavailableError`, `PaymentInProgressError`; перевод в ProblemDetails в `ResultHttpExtensions`.
- `Application/Messages`: `ReceiptRequested`; `Infrastructure/Wallet/` (`WalletClient`, `WalletOptions`),
  `Modules/WalletModule.cs`; пакет `Microsoft.Extensions.Http.Resilience` в `Billing.Api.csproj`.
- Диспетчер outbox: общая обработка сообщений нескольких типов (Ledger, Receipt) с `FOR UPDATE SKIP LOCKED`, чтобы три
  реплики не слали дубли; сейчас он ловит только `LedgerUnavailableException` - исключение другого типа убьёт
  фоновый сервис, обработку ошибок надо расширить.
- Тесты в рамках задачи не требуются (RUL-0002), но сценарии из п. 5 - основа приёмки.

## 8. Вопросы к Payments и продукту (блокируют детали)

1. Сколько Wallet хранит ключи идемпотентности? Должно быть больше горизонта повторов (24 ч+), иначе повтор
   по таймауту может списать второй раз.
2. Есть ли у Wallet чтение операции по ключу и отчёт для ежедневной сверки? Формат тела debit, коды окончательных
   отказов (insufficient funds и т. п.), лимиты RPS.
3. Валюта кошелька и счёта могут различаться? Предположение: совпадают; иначе отказ `currency_mismatch`
   (пересчёт через FX здесь не делаем).
4. Где живёт флаг автосписания клиента и как им управляют.
5. Бизнес-часовой пояс «срока наступил»; окно ночи; предел повторов автосписания после отказа.
6. Поддерживает ли Notifications дедупликацию чека по ключу (иначе возможен редкий дубль письма).
