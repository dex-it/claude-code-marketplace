# BILL-41: оплата счёта с баланса Wallet - проектное решение

Код не пишется; документ описывает, что и где менять. Опирается на ADR-0002 (Result), 0004 (Money в
минорных единицах), 0006 (Ledger через outbox), 0007 (HTTP-устойчивость), RUL-0003 (форма хендлера).

## 1. Суть решения

1. Оплата идёт в **три шага с двумя короткими транзакциями и без транзакции вокруг вызова Wallet**:
   (1) зафиксировать намерение и ключ идемпотентности, (2) вызвать Wallet, (3) зафиксировать итог.
2. Двойное списание исключено **двумя независимыми механизмами**: оптимистичный захват счёта
   (выигрывает один из конкурентов) и стабильный `Idempotency-Key`, который сохраняется до первого
   вызова и переиспользуется при любом повторе.
3. Неопределённый исход (таймаут, 5xx, обрыв, открытый circuit breaker) - это **не отказ**: счёт
   остаётся в `PaymentPending`, повтор идёт с тем же ключом. Новый ключ выдаётся только после
   однозначного отказа Wallet.
4. Ledger и Notifications не участвуют в пути оплаты синхронно: обе записи - сообщения outbox в той
   же транзакции, что и `Paid`. Их недоступность не влияет на оплату.
5. Wallet изолирован от котировок FX: отдельный типизированный клиент со своим конвейером и пулом
   соединений, ограниченный параллелизм, ни одной блокировки БД на время вызова.
6. Ночное задание - один ведущий исполнитель (advisory lock в Postgres) с ограниченным числом
   «дорожек»; корректность держится на захвате счёта, а не на блокировке.

## 2. Домен (`Domain/`)

Агрегат остаётся один - `Invoice`; отдельного агрегата «платёж» нет, поэтому итог оплаты - одна
транзакция над одним агрегатом (+ outbox, он не агрегат).

Статусы: `Draft, Issued, PaymentPending, Paid, Cancelled`. `PaymentPending` - новое значение enum;
enum отдаётся в JSON строкой (2ca40d4), то есть это изменение контракта для фронта - сообщить
заранее.

Новые поля `Invoice` (у каждого есть читатель):

| Поле | Читатель |
|---|---|
| `PaymentAttemptId` (Guid?) - он же `Idempotency-Key` | шлюз Wallet; повтор после сбоя |
| `PaymentStartedAt` (DateTimeOffset?) | определение «зависшей» оплаты, алерт |
| `LastWalletDeclineCode`, `LastWalletDeclineAt` | личный кабинет (причина), ночное задание (не пытаться дважды за ночь) |

Имена по значению, не по Wallet API: `PaymentAttemptId`, а не `IdempotencyKey`/`DebitId`; коды
отказа - доменные (`InsufficientFunds`, `WalletNotFound`, ...), а не HTTP-статусы Wallet.

Переходы - только методами `Invoice` (не снаружи):

- `BeginWalletPayment(attemptId, at)`: `Issued -> PaymentPending`; запоминает ключ и время.
- `ResumeWalletPayment(at)`: допустим только из `PaymentPending`, если оплата «зависла»
  (`IsWalletPaymentStale(at, timeout)` - расчёт внутри сущности); ключ не меняется.
- `CompleteWalletPayment(at)`: `PaymentPending -> Paid`, `PaidAt = at`.
- `DeclineWalletPayment(code, at)`: `PaymentPending -> Issued`, пишет отказ, обнуляет ключ.
- `Cancel()` из `PaymentPending` запрещён (`CancelInvoiceHandler` уже допускает только
  `Issued/Paid` - менять не нужно). Это гарантирует, что после успешного списания счёт всегда
  можно перевести в `Paid`: компенсирующее зачисление (`/credits`) в этом сценарии не нужно.

Деньги - `Money(long Minor, string Currency)` (ADR-0004); в Wallet уходит сумма и валюта счёта.

Новые ошибки (наследники `BillingError`, ADR-0002): `WalletDebitDeclinedError(code)`,
`InvoicePaymentInProgressError`. Существующие `InvoiceNotFoundError`/`InvoiceInvalidStateError`
переиспользуются.

## 3. Application (срез `Handlers/Invoices/`, RUL-0003)

Порты (`Application/Abstractions/`):

- `IWalletGateway.DebitAsync(WalletDebitRequest(PaymentAttemptId, CustomerId, Money), ct)` ->
  значение `WalletDebitOutcome`: `Succeeded | Declined(code) | Unknown`. Это не тонкая обёртка:
  шлюз переводит транспортные детали (статусы, таймауты, `BrokenCircuitException`,
  `TaskCanceledException`) в доменный исход. Неопределённость - значение, а не исключение (на
  ожидаемом пути, ADR-0002).
- `IInvoiceRepository` - два новых узких метода, нужных сценариям:
  `ListDueForAutoDebitAsync(DateOnly runDate, WorkSlice slice, int batch, ct)` (возвращает id, не
  сущности; `ListByStatusAsync(Issued)` на 40 тыс. счетов не годится) и
  `ListStalePaymentsAsync(DateTimeOffset olderThan, WorkSlice slice, int batch, ct)`.
  Specification не вводим - запросов два, оба простые.
- `SaveAsync` при конфликте версии бросает `InvoiceConcurrencyException` (тип объявлен в
  Abstractions); хендлер превращает её в `InvoicePaymentInProgressError`. `IUnitOfWork` не
  добавляем: как и сейчас, `IOutbox.EnqueueAsync` и `SaveAsync` работают в одном scope/соединении
  и коммитятся вместе в `SaveAsync` (контракт реализации Postgres в BILL-34, см. §6).

Хендлеры:

- `PayInvoiceFromWalletHandler.HandleAsync(PayInvoiceFromWalletCommand(InvoiceId), ct)` ->
  `Result<WalletPaymentOutcome>` (`Paid | Pending`). Единственный путь оплаты; его используют
  ручной эндпоинт, ночное задание и восстановление. Зависимости: `IInvoiceRepository`,
  `IWalletGateway`, `IOutbox`, `TimeProvider`. Тело - три приватных шага одного уровня:
  - **Claim**: загрузить счёт; `Issued` -> `BeginWalletPayment(Guid.NewGuid())`;
    `PaymentPending` и «зависшая» -> `ResumeWalletPayment`; `PaymentPending` свежая ->
    `InvoicePaymentInProgressError`; иное состояние -> `InvoiceInvalidStateError`. `SaveAsync`
    (транзакция 1, версия счёта проверяется) - проигравший конкурент получает
    `InvoicePaymentInProgressError`, Wallet не вызывается.
  - **Debit**: `IWalletGateway.DebitAsync` - без транзакции и без блокировок БД.
  - **Settle** (транзакция 2, одна): `Succeeded` -> `CompleteWalletPayment`, в outbox
    `LedgerPostingRequested("pay-{id}", Amount, ...)` и `ReceiptRequested(...)`; `Declined` ->
    `DeclineWalletPayment`, результат `WalletDebitDeclinedError`; `Unknown` -> ничего не
    меняется, результат `Pending`.
  Валидатор не нужен (команда - один id); если понадобится, отдельным файлом рядом.
- `AutoDebitDueInvoicesHandler.HandleAsync(AutoDebitDueInvoicesCommand(runDate, slice), ct)`:
  берёт пачку id (сначала зависшие `PaymentPending`, затем должники), последовательно вызывает
  `PayInvoiceFromWalletHandler`. Политика остановки: после K подряд исходов `Pending`
  (по умолчанию 5) дорожка прекращает работу - Wallet считаем недоступным, не плодим
  `PaymentPending`. Возвращает счётчики (оплачено/отказ/ожидает/остановлена) для логов.

Старый `PayInvoiceHandler` и `/pay` не трогаем (долг ADR-0006 закрывается отдельной правкой).

## 4. Infrastructure и API

**Wallet-клиент** (`Infrastructure/Wallet/`): `WalletClient` + `WalletGateway : IWalletGateway`,
`WalletOptions`, регистрация в `Modules/WalletModule.cs` через `AddHttpClient<WalletClient>` и
`.AddStandardResilienceHandler()` (ADR-0007; `AddPolicyHandler` не используем). Нужен пакет
`Microsoft.Extensions.Http.Resilience` в csproj. Дефолты стандартного обработчика (таймаут попытки
10 с, общий 30 с) **не подходят**: Wallet отвечает до 30-40 с. Настройка (значения в `WalletOptions`,
уточняются с Payments):

- `AttemptTimeout` ~45 с, `TotalRequestTimeout` ~60 с; повторы внутри конвейера - 0-1 (повтор по
  сути делает восстановление на следующем тике с тем же ключом);
- `CircuitBreaker.SamplingDuration` не меньше 2x `AttemptTimeout` (требование библиотеки);
  открытый breaker во время релиза Wallet (3-5 мин) и инцидентов - штатно, шлюз отдаёт `Unknown`;
- тело запроса при повторе с тем же ключом идентично (сумма, валюта) - иначе Wallet может отвергнуть
  повтор как конфликт ключа;
- `Idempotency-Key` = `PaymentAttemptId`. Однозначным отказом (`Declined`) считается только
  задокументированный отказ Wallet по бизнес-причине; всё остальное, включая неожиданные 4xx, -
  `Unknown`.

**Изоляция от котировок.** `FxRatesClient` - другой типизированный клиент, свой конвейер, свой
`SocketsHttpHandler`/пул соединений, свой breaker; медленный Wallet не занимает ресурсов FX. Все
вызовы асинхронные, потоки не блокируются, соединение БД на время вызова не держится (транзакции 1 и
2 короткие). Дополнительно ограничиваем параллелизм Wallet: ручные вызовы не ограничены (их
естественно мало), ночные - `Lanes` дорожек. `FxRatesClient` и `FxModule` в этой задаче не
правим (перевод на ADR-0007 - при их следующей правке).

**Нотификации.** `ReceiptRequested(InvoiceId, CustomerId, Money, PaidAt)` - сообщение outbox;
`ReceiptOutboxDispatcher` (по образцу `LedgerOutboxDispatcher`) шлёт чек в Notifications фоном,
ограниченное число попыток, затем сообщение помечается отброшенным и логируется. Сбой Notifications
никогда не откатывает и не задерживает `Paid`. Дубль чека допустим как меньшее зло; если
Notifications принимает ключ дедупликации - передаём `receipt-{invoiceId}`.

**Ledger.** Проводка `pay-{invoiceId}` через `IOutbox` (ADR-0006), `ILedgerGateway` не используем.
Недоступность Ledger не влияет на оплату: сообщение ждёт в outbox.

**Эндпоинт.** `POST /invoices/{id:guid}/pay-from-wallet` в `InvoiceEndpoints`:
`Paid` -> 200 `{status:"Paid"}`; `Pending` -> 202 `{status:"PaymentPending"}`;
`WalletDebitDeclinedError`, `InvoicePaymentInProgressError`, неверное состояние -> 409 с `code`
(через `ResultHttpExtensions`), `NotFound` -> 404. Ручной вызов ограничен дедлайном запроса
(по умолчанию 10 с, linked `CancellationToken`): не дождались Wallet - возвращаем 202, а доведёт
оплату восстановление с тем же ключом. Отмена токена после отправки - тоже `Unknown`, не отказ.
Повторное нажатие кнопки не опасно: свежий `PaymentPending` -> 409 `payment_in_progress`.

## 5. Ночное задание

`WalletAutoDebitWorker` (`Infrastructure/Wallet/`, `BackgroundService`) отвечает только за
расписание, лидерство и дорожки; бизнес-правила - в Application.

- Запускается на всех трёх репликах, но работает **одна**: `pg_try_advisory_lock(<ключ задания>)` на
  выделенном соединении; не получили - спим и пробуем позже (подхватим, если лидер упал: блокировка
  снимается вместе с соединением). Блокировка - оптимизация (не гоним три одинаковых сканирования);
  при потере/двойном лидерстве корректность сохраняется за счёт захвата счёта и ключа.
- Окно: старт после полуночи UTC, `runDate` - текущая дата UTC (часовой пояс клиента - вопрос §7).
  Тик каждые 1-2 мин: сначала восстановление зависших `PaymentPending` (старше `2 x
  TotalRequestTimeout`), затем новые должники. Конец окна - настраиваемый крайний час; недоплаченное
  уходит на следующую ночь (счёт остаётся `Issued`, срок только растёт).
- `Lanes` дорожек (по умолчанию 8-16), у каждой свой DI-scope на пачку и свой срез
  (`WorkSlice(index, count)`, разбиение по хэшу id), чтобы дорожки не пересекались.
- Отбор: `Issued`, `DueDate <= runDate`, автосписание включено, нет отказа Wallet за `runDate`.
  Счёт с отказом (нет средств) в эту ночь больше не трогаем.
- Пропускная способность: при задержке ~1 с и 16 дорожках 40 тыс. - около 45 минут; при 30-40 с -
  это сутки, поэтому при деградации Wallet задание не «долбит» его, а останавливает дорожки
  (политика K подряд `Pending`), делает паузу и продолжает на следующем тике. Лимит RPS на Wallet
  согласуем с Payments.
- Ручная оплата и автосписание на одном счёте: кто первым закоммитил транзакцию 1, тот и платит;
  второй получает `PaymentInProgress`/`InvalidState` и Wallet не вызывает. Если оба всё же дошли
  до Wallet (после восстановления) - ключ один, Wallet вернёт прежний результат.

## 6. Что хранится и где (Billing, Postgres, BILL-34)

- Таблица счетов: новые колонки из §2 + версия строки (`xmin` или явный `Version`) для
  оптимистичного захвата; индекс под `ListDueForAutoDebitAsync` (`status`, `due_date`) и под
  `ListStalePaymentsAsync` (`status`, `payment_started_at`), оба частичные по `Issued` /
  `PaymentPending`.
- Outbox: общая таблица с типом сообщения; каждый диспетчер забирает свой тип с `FOR UPDATE SKIP
  LOCKED`, чтобы три реплики не слали одно и то же. Для Ledger дубль безопасен (`ExternalId`
  уникален), для чека - нежелателен.
- Запись `Paid` + две записи outbox - одна транзакция; единственный агрегат в ней - `Invoice`.
- Состояние Wallet (баланс, журнал списаний) принадлежит Wallet; Billing его не копирует и не
  кэширует (ADR-0005 к Wallet не применим: это не справочник).
- Флаг автосписания клиента - вне `Invoice`; предположение: хранится в Billing отдельной таблицей
  настроек клиента и читается внутри `ListDueForAutoDebitAsync` (см. §7).

## 7. Поведение при сбоях

| Ситуация | Поведение |
|---|---|
| Wallet медленный (до 40 с) | Таймауты настроены под это; ручной запрос по дедлайну отдаёт 202, оплата доводится фоном |
| Wallet лежит (релиз, инцидент) | Breaker открыт -> `Unknown`; дорожки останавливаются после K `Pending`; оплата доводится после восстановления тем же ключом; клиент видит `PaymentPending` |
| Сбой реплики после транзакции 1 | Ключ сохранён; восстановление повторит вызов с тем же ключом |
| Сбой реплики после ответа Wallet, до транзакции 2 | То же; Wallet вернёт прежний результат, повторного списания нет |
| Отказ Wallet (нет средств) | `Declined` -> счёт `Issued`, причина записана, ключ сброшен; повторная попытка - новым ключом, в ту же ночь автоматом не делается |
| Дольше N часов в `PaymentPending` | Алерт; ручной разбор. Автоматического возврата в `Issued` нет - он открыл бы двойное списание |
| Ledger недоступен | Оплата не затронута; проводка ждёт в outbox |
| Notifications недоступен | Оплата не затронута; чек ретраится ограниченно и отбрасывается |
| Конкурентные ручной и ночной вызовы | См. §5: один захват, один ключ |
| Отмена счёта во время оплаты | Запрещена (`PaymentPending`) |

## 8. Проверка по дисциплине команды

- SOLID: оплата - один хендлер без ветвления по источнику (ручной/ночной/восстановление различаются
  только вызывающим); расписание и бизнес-правила разведены (worker / handler); `IWalletGateway`
  содержит перевод исходов, а не пересылает вызов; расчёт «зависла ли оплата» - внутри `Invoice`.
- DDD: переходы только методами `Invoice`; один агрегат в транзакции; новых репозиториев для
  дочерних сущностей нет; новые поля имеют читателей; имена доменные, без терминов Wallet API.
  Коллекций, растущих без границы, не добавляется.
- Clean Architecture: срез по фиче (`Handlers/Invoices/`, `Infrastructure/Wallet/`), без
  Shared/Common; зависимости направлены внутрь (Application знает `IWalletGateway`, не `HttpClient`);
  бизнес-логика оплаты проверяема без HTTP - через домен и хендлер с подставным шлюзом; узкие методы
  репозитория не дублируют specification (её нет).

## 9. Открытые вопросы (к Payments и продукту)

1. Срок хранения `Idempotency-Key` в Wallet (должен покрывать окно восстановления, не меньше суток)
   и поведение при повторе с телом, отличным от исходного.
2. Исчерпывающий список бизнес-отказов Wallet (что `Declined`, что `Unknown`) и допустимый RPS
   в ночь.
3. Валюта баланса Wallet и счёта: что при несовпадении (в этом решении - списываем в валюте счёта,
   отказ Wallet = `Declined`).
4. Где живёт флаг автосписания клиента и часовой пояс «наступившего срока» (принято: Billing, UTC).
5. Возврат клиенту при `Cancel` оплаченного счёта: сейчас отмена только сторнирует проводку в
   Ledger, `/credits` не вызывается - вне BILL-41, но денежный разрыв; нужна отдельная задача.
6. Поддерживает ли Notifications ключ дедупликации чека.

## 10. Файлы и ADR

Изменения: `Domain/Invoice.cs` (+ статус, поля, методы), `Domain/Errors.cs`,
`Application/Abstractions/` (`IWalletGateway`, расширение `IInvoiceRepository`,
`InvoiceConcurrencyException`), `Application/Handlers/Invoices/` (два новых хендлера),
`Application/Messages/ReceiptRequested.cs`, `Api/InvoiceEndpoints.cs`,
`Infrastructure/Wallet/` (клиент, шлюз, опции, worker), `Infrastructure/Notifications/`
(диспетчер чека), `Infrastructure/Persistence/` (Postgres, BILL-34), `Modules/WalletModule.cs`,
`Modules/InvoicesModule.cs`, `Billing.Api.csproj` (пакет Resilience).

Это решение стоит оформить как **ADR-0008** («Оплата с Wallet: намерение с ключом, вызов вне
транзакции, неопределённость не равна отказу»); в рамках этой задачи записан только DESIGN.md.
