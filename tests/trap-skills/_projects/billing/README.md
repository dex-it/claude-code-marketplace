# Мини-проект Billing: общий вход наборов групп 0 и 1.1

Сервис счетов на .NET 8 с историей коммитов, ADR, сводом правил и закрытым пакетом. Вход наборов
[fact-verification](../../fact-verification/README.md),
[codebase-conventions](../../codebase-conventions/README.md) (группа 0) и
[review-evidence](../../review-evidence/README.md), [owasp-security](../../removed/owasp-security/README.md)
и остальных скиллов группы 1.1. Файл - ключ для судьи, исполнителю
не подаётся: `setup.sh` его в каталог прогона не копирует.

```
setup.sh <dest> [ветка]   разворачивает git-репозиторий: stages/* - коммиты main, branches/<имя>/* - ветка feature/<имя>
vendor/                   исходник Acme.Ledger.Client 2.3.1; в прогон попадает только nupkg в packages-local/ (DebugType none, без XML-doc)
stages/                   1 счета+Ledger+FX, ADR-0001..0005; 2 outbox, ADR-0006; 3 ADR-0007 вместо ADR-0003; 4 свод docs/rules (RUL-0001..0004); 5 enum в JSON строками (`ApiModule`)
branches/                 ветки кейсов R1, R0, R2, R3, E1, E0, S1, S2, S3, S4
```

Нужны SDK с рантаймом 8.0 и сеть до nuget.org; для звена декомпиляции - `ilspycmd`.

## Кейсы

| Кейс | Ветка | Поручение |
|---|---|---|
| R1 | `feature/invoice-reminders` | ревью MR: напоминания о просрочке, пеня, повтор проводки, валюты из конфигурации |
| R0 | `feature/tax-in-quote` | ревью MR: котировка с НДС; верный исход - ни одной находки в предмете обоих скиллов |
| R2 | `feature/invoice-reissue` | ревью MR: повторное выставление счёта заменяет прежний |
| R3 | `feature/invoice-export` | ревью MR: выгрузка счетов партнёру, статус кодом |
| E1 | `feature/invoice-refunds` | ревью MR: частичный возврат по задаче BILL-17, тред обсуждения в описании |
| E0 | `feature/invoice-card` | ревью MR: карточка счёта; верный исход - ни одной ложной находки и ни одной blocker/major |
| S1 | `feature/customer-portal` | ревью MR: личный кабинет клиента по задаче BILL-21 - вход с JWT, свои счета и документы, профиль, бэк-офис |
| S2 | `feature/invoice-print` | ревью MR: печать счёта в HTML и PDF, поиск по отчётной БД с пересчётом валюты, заметка оператора |
| S3 | `feature/invoice-statement` | ревью MR: акт сверки клиента по задаче BILL-24 |
| S4 | `feature/invoice-installments` | ревью MR: рассрочка по счёту по задаче BILL-25, с unit-тестами графика |
| F1 | `main` | фича: частичный возврат по оплаченному счёту |

Промпты - в README наборов.

## Ключ

K - дефект под ловушку, P - приманка (находка по ней ложная), O - дефект вне скилла.

**R1**

| Код | Класс | Место | Суть |
|---|---|---|---|
| KD | K fact-verification | `LedgerOutboxDispatcher.cs`, комментарий в `PostWithRetryAsync` | «клиент ставит Idempotency-Key = ExternalId» ложно: ключ - `Guid.NewGuid()` на каждый вызов, повтор после таймаута даёт дубль проводки. Доказывается только декомпиляцией |
| KP | K fact-verification | `BillingOptions.AllowedCurrencies = ["RUB"]` + `appsettings.Production.json` | «конфигурация заменяет список» ложно: биндер дописывает, RUB остаётся. Проба на Binder 8.0.2: `RUB,USD,EUR`. В документации не описано, только issues dotnet/runtime #46988, #62112 |
| KS | K conventions | `NotificationsModule`: `AddPolicyHandler` «по ADR-0003» | ADR-0003 Superseded by ADR-0007 |
| KL | K conventions | `AddSingleton<SendDueRemindersHandler>` «как LedgerOutboxDispatcher» | слепая копия lifetime: captive scoped `IInvoiceRepository`, `ILedgerGateway` |
| KA | K conventions | `SendDueRemindersHandler` проводит пеню через `ILedgerGateway` | ADR-0006: только outbox; легаси-сосед `PayInvoiceHandler` - долг |
| KR | K conventions | `PayInvoiceHandler`: `throw InvalidOperationException` | ADR-0002: Result + наследник `BillingError` |
| KG | K conventions | `NotifyAsync(Guid customerId, Guid invoiceId)` вызван наоборот | сырой Guid против typed-id |
| - | дефект кейса | `CreateInvoiceHandler` стал upsert; doc-комментарий `NotificationRequest` называет Mailer | ключ спорный: create-or-update заявлен в MR, тип - проводной контракт Mailer. Из ключа выведены, предмет перенесён в R2 |
| P1 | P | «Клиент бросает её на 503 и 429» | верно |
| P2 | P | «значение из конфигурации перекрывает дефолт» у скаляра `MaxInvoiceAmountMinor` | верно |
| P3 | P | синхронный FX в напоминании | покрыт ADR-0005; «кэшировать» - ложная находка |
| P4 | P | нет XML-doc, нет тестов | RUL-0001, RUL-0002 снимают |
| O1 | O | `DueDate >= Today` | пропускает день срока |
| O2 | O | пеня `Minor*daysLate/1000` каждый день | кумулятивная переплата |
| O3 | O | `_ = Task.Delay(...)` | повтор без паузы |

**R0.** `TaxModule` на `AddStandardResilienceHandler` с верным комментарием о дефолтах (3 повтора,
экспоненциально, попытка 10 с, общий 30 с; learn.microsoft.com/dotnet/core/resilience/http-resilience) -
P для fact-verification; отступление от соседа `FxModule` верно по ADR-0007, налог синхронно по
ADR-0005 - P для conventions. Законная находка вне скиллов: `country` без валидации идёт в путь URL.

**R2**

| Код | Класс | Место | Суть |
|---|---|---|---|
| KN | K conventions | `InMemoryInvoiceRepository.AddAsync` | стал заменой прежнего счёта, имя не сменено; через `SaveAsync -> AddAsync` новое поведение получают и оплата, и отмена |
| KC | K conventions | doc-комментарий `Invoice` | называет потребителей типа |

**R3.** Факт о библиотеке, который переопределяет код проекта.

| Код | Класс | Место | Суть |
|---|---|---|---|
| KJ | K fact-verification | `ExportInvoicesHandler`, комментарий у `ExportedInvoice` | «System.Text.Json пишет enum числом» верно для дефолта библиотеки, ложно в проекте: `ApiModule` (стадия 5, вне диффа) добавляет `JsonStringEnumConverter` в `ConfigureHttpJsonOptions`. Проба: `"status":"Issued"` - партнёр, ждущий код, выгрузку не разберёт |
| PJ | P | тот же комментарий | «имена полей camelCase» верно: проект naming policy не переопределяет, проба - `amountMinor` |

Стадия 5 правит `Program.cs`; копии `Program.cs` в ветках R1, R0 несут ту же строку, их дифф с `main` не изменился.

**F1.** K: проводка через outbox (`LedgerPostingRequested`), а не `ILedgerGateway` легаси-соседа;
ошибки - Result и наследник `BillingError`; хендлер в `Handlers/Invoices`, валидатор отдельным
файлом от `BillingValidator<T>`, регистрация в `InvoicesModule`, endpoint в `InvoiceEndpoints`
(RUL-0003); `HandleAsync(cmd, CancellationToken)`; typed id; `Money`/`long` (ADR-0004). Мины:
возврат только по оплаченному счёту, сумма возвратов проверяется накопительно.

**E1.** Задача `docs/tasks/BILL-17-refunds.md` - первым коммитом ветки. Тесты `tests/Billing.Tests`
появляются в этом MR; сьют зелёный (2/2).

| Код | Класс | Место | Суть |
|---|---|---|---|
| KC | K review-evidence: путь, граница | `CancelInvoiceHandler` (вне диффа) | отмена оплаченного счёта с возвратами сторнирует полную сумму: возвращено больше оплаты на сумму возвратов. Условие - у счёта есть возврат. В треде QA спросил вопросом «наверное мелочь», автор отмёл. Засчитывается находка с условием и severity blocker/major |
| KI | K review-evidence: намерение | BILL-17 «не больше трёх возвратов» | лимита нет; описание MR его не называет, только задача |
| KX | K review-evidence: сверка автора | `RefundInvoiceHandler`, ExternalId `refund-{invoice.Id}` | ADR-0006: `ExternalId` уникален на операцию, BILL-17: каждый возврат - отдельная проводка; у всех возвратов счёта ExternalId один. Автор пишет «сверено: ADR-0006» |
| KT | K review-evidence: покрытие | `RefundInvoiceHandlerTests` | описание: «накопительный лимит покрыт тестами, сьют зелёный»; ни один тест не делает двух возвратов. Проба: мутация `refundedMinor + command.AmountMinor` -> `command.AmountMinor` оставляет 2/2 зелёными |
| KS | K review-evidence: severity по тону | тред: «БЛОКЕР!!! переименуй `refundedMinor`» | имя поведения не меняет. Провал - находка об имени с blocker/major |
| P1 | P, scope | `PayInvoiceHandler`: прямой `ILedgerGateway` (файл тронут одной строкой описания проводки) | долг по ADR-0006, изменением не внесён. Провал - blocker этого MR; не поднят или помечен предсуществующим без блокировки - верно |
| P2 | P, отрицательный вывод | письмо клиенту о возврате | вне задачи (BILL-18 в тексте BILL-17) |
| P3 | P | отрицательная сумма проводки возврата | так же сторнирует `CancelInvoiceHandler`; `LedgerOutboxDispatcher` отправляет любой `LedgerPostingRequested` |
| P4 | P, отсутствие | проверка суммы > 0 | есть в `RefundInvoiceValidator` |
| O1 | O | check-then-act в `RefundInvoiceHandler` | два параллельных возврата проходят проверку оба: общий объект `Invoice` из `InMemoryStore`, `List` не потокобезопасен. Верна только при параллельных запросах - поднята без условия считается провалом границы |

**E0.** Карточка счёта `GET /invoices/{id}`, код верен.

| Код | Класс | Суть |
|---|---|---|
| PE | P | `Status` уходит строкой: `ApiModule` (стадия 5, вне диффа) |
| PN | P | нет счёта - 404: `ResultHttpExtensions` отображает `NotFoundError` |
| PA | P, scope | авторизации нет во всём сервисе; blocker этого MR - провал |
| PV | спорная | нет валидатора: у `Pay`/`Cancel` без входных полей его тоже нет. Не засчитывается, если не blocker/major |

**S1 и S2** - общий контроль группы 1.1: засеяны дефекты `owasp-security`, `performance-review`,
`testability`, `no-loose-ends` сразу; `output-hygiene` (снят) судился по форме выходов. Класс - префиксом
кода: K - owasp, F - performance, T - testability, L - no-loose-ends. Все K-коды подтверждены пробой
на собранном сервисе.

**S1.** Задача `docs/tasks/BILL-21-portal.md` - первым коммитом ветки: профиль клиент правит только
имя и email, лимит и верификацию - бэк-офис; с Q1 2027 сервисом пользуются дочерние компании, данные
не пересекаются (BILL-30).

| Код | Класс | Место | Суть |
|---|---|---|---|
| KJ | K | `PortalTokens.ReadCustomerId` | `ReadJwtToken` без проверки подписи: токен с чужим ключом принят |
| KO | K | `GetCustomerInvoiceHandler` | `CustomerId` запроса не сравнивается: клиент A читает счёт B |
| KB | K | `InMemoryInvoiceDocumentRepository.FindAsync` | поиск только по имени, `invoiceId` игнорируется: свой `act.pdf` отдаёт документ B |
| KM | K | `PUT /portal/profile`, `UpdateCustomerProfileHandler` | биндится и сохраняется `Customer` целиком: клиент ставит себе лимит и `IsVerified` |
| KE | K | `GET /portal/profile` | ответ - сущность целиком, в нём `PasswordHash` |
| KK | K, L | `PortalOptions.SigningKey` | ключ подписи литералом в коде, в конфиге его нет |
| KH | K | `PasswordHasher` | SHA-256 без соли |
| KR | K | `/portal/login` | ни лимита запросов, ни блокировки по попыткам |
| KL | K | `LoginCustomerHandler` | выданный токен пишется в лог |
| KT | K | `Customer`, репозитории | нет измерения компании при объявленном BILL-30 |
| LD | L | `DemoCustomerSeeder` | демо-клиент с известным паролем заводится на любом окружении |
| LT | L | `PortalTokens`, `// TODO: refresh-токены` | TODO без тикета |
| P1 | P | `ListCustomerInvoicesHandler` | фильтр по владельцу верен |
| P2 | P | `GetInvoiceDocumentHandler` | проверка владельца счёта верна (ломает её KB ниже по потоку) |
| P3 | P | `PasswordHasher.Verify` | `FixedTimeEquals` |
| P4 | спорная | `POST /customers`, `POST /invoices/{id}/documents` | без auth, как весь бэк-офис сервиса; находка не провал |
| P5 | P | `ReadCustomerId` | `ValidTo` проверяется |

**S2.** Описание MR: заголовок печатной формы передаёт фронт.

| Код | Класс | Место | Суть |
|---|---|---|---|
| KQ | K | `SearchInvoicesHandler` | `FromSqlRaw` с интерполяцией имени, EF1002 заглушён pragma «экранирует фронт»: `zzz' OR 1=1 --` отдаёт все строки |
| KC | K | `PdfRenderer` | `fileName` из запроса в `/bin/sh -c`: `x; touch ... #` исполнен |
| KX | K | `PrintInvoiceHandler` | `title` в HTML без кодирования, `customer` и `note` кодируются |
| KU | K | `POST /invoices/{id}/note` | оператор из заголовка `X-Operator-Id`, «auth пока нет» |
| FN | F | `SearchInvoicesHandler` | курс FX запросом на каждую строку |
| FA | F | `SearchInvoicesHandler` | выборка без лимита |
| FR | F | `SearchInvoicesHandler` | `new Regex` в цикле |
| FH | F, T | `LogoLoader` | `new HttpClient()` на вызов, статический класс |
| TT | T | `PrintInvoiceHandler` | `DateTime.Now`, в проекте есть `TimeProvider` |
| TE | T | `PdfRenderer` | путь к wkhtmltopdf из переменной окружения внутри метода |
| TF | T | `PrintInvoiceHandler`, `PdfRenderer` | `File.ReadAllText`, временные файлы напрямую |
| TC | T | `ReportingDbContext` | `EnsureCreated()` в конструкторе |
| TS | T | `PdfRenderer` | `sealed` без интерфейса, потребитель зависит от класса |
| LF | L | `LogoLoader` | `catch { return ""; }` |
| LL | L | `SearchInvoicesHandler` | `catch (HttpRequestException) { rate = 1m; }` |
| LP | L | `PdfRenderer` | `Console.WriteLine` |
| LZ | L | `PrintFormat.Xlsx` | `NotImplementedException` в доступном варианте enum |
| LS | L | `InvoicePrintTests.Pdf_IsRendered` | `Skip` |
| LA | L | `InvoicePrintTests.Html_IsRendered` | `Assert.NotNull` на строке |
| LV | L | `Billing.Api.csproj` | пакет `8.0.0-rc.2` |
| P1 | P | `SearchInvoicesHandler` | `FromSqlInterpolated` по периоду параметризован |
| P2 | P | `PrintInvoiceHandler` | `customer`, `note` через `HtmlEncode` |
| P3 | спорная | поиск и печать без auth | как весь бэк-офис |
| O1 | O | `PdfRenderer` | временные файлы не удаляются |
| O2 | O | `PdfRenderer` | код выхода процесса не проверяется |

**S3.** Задача `docs/tasks/BILL-24-statement.md` - первым коммитом ветки: только JSON, Excel с
группировкой - BILL-27, решения нет; черновики и отменённые в акт не входят. Тестов задача не требует
(RUL-0002).

| Код | Класс | Место | Суть |
|---|---|---|---|
| LU | L | `StatementHttpResults.ToStatementResult` | дубль `ResultHttpExtensions.ToHttp`, разъехался: без ProblemDetails и `code`, прочие ошибки 500 вместо 409 |
| LX | L | `IStatementFormatter`, `StatementFormatterRegistry`, `StatementRenderOptions` | реестр форматов под один JSON, опции Excel (`Grouping`, `SheetName`, `FreezeHeader`, `IncludeDrafts`) никто не читает |
| PX | P | `MoneyConversion.ConvertTo` | вынос пересчёта: два потребителя (`QuoteInvoiceHandler`, `BuildStatementHandler`), поведение котировки не изменилось |
| PR | P | `BuildStatementHandler` | курс запрашивается один раз на валюту |
| O1 | O | `BuildStatementHandler` | отменённые счета входят в акт и итог, задача их исключает |

**S4.** Задача `docs/tasks/BILL-25-installments.md` - первым коммитом ветки: остаток - в первый
платёж, дата разбиения по МСК при серверах в UTC, перенос на рабочий день по
`calendar/holidays.txt`, доля выборочного контроля задаётся эксплуатацией, максимум N меняется без
релиза; расчёт графика и выборочный контроль покрыть unit-тестами. Тесты ветки зелёные в зоне МСК,
под `TZ=UTC` тест графика падает.

| Код | Класс | Место | Суть |
|---|---|---|---|
| TZ | T | `InstallmentScheduleBuilder`, тест `Build_MonthEnd_...` | дата - через `TimeZoneInfo.Local`; тест с 21:30 UTC проходит только в зоне МСК |
| TF | T | `InstallmentScheduleBuilder` | календарь читается `File.ReadAllLines` из `AppContext.BaseDirectory` внутри расчёта, праздники в тесте не подменить |
| TG | T | `InstallmentScheduleBuilder` | id платежа - `Guid.NewGuid()` внутри расчёта |
| TR | T | `InstallmentAuditSampler` | `Random.Shared` - выборка не воспроизводится, тест `Skip` |
| TE | T | `InstallmentAuditSampler` | доля - `Environment.GetEnvironmentVariable` в методе, мимо `IConfiguration` |
| TS | T | `InstallmentAuditSampler`, `AuditMailer` | зависимость от `sealed AuditMailer` (SMTP) без абстракции - выборку не проверить без почты |
| TC | T | `BillingConfig`, `ScheduleInstallmentsValidator` | статический `BillingConfig.Current`; тест подменяет глобальную статику |
| TI | T | `DueDateRules` | `internal` без `InternalsVisibleTo`: перенос на праздники тестами не покрыт |
| PS | P | `MoneySplit.Split` | статическая чистая функция - тестируема как есть |
| PT | P | `InstallmentScheduleBuilder` | `TimeProvider` внедрён и подменяется в тесте |
| O1 | O | `MoneySplit.Split`, тест `Split_...` | остаток - в последний платёж, задача требует в первый; тест закрепляет ошибку |

## Группа 1.2: архитектура в диффе

Кейсы скиллов `solid`, `clean-architecture`, `ddd`, `microservices`, `distributed-resilience`
(эпик #291, #294). Ключ записан до первого прогона. Ветки - `branches/<имя>`, стадии `main` не
тронуты.

| Кейс | Ветка | Поручение |
|---|---|---|
| A0 | `feature/invoice-discount` | ревью MR: скидка на счёт (BILL-35); верный исход - ни одной находки в предмете скиллов группы |
| A1 | `feature/subscriptions` | ревью MR: подписки (BILL-31) - доменная модель |
| A2 | `feature/credit-notes` | ревью MR: кредит-ноты (BILL-33) - слои, EF Core + SQLite |
| A3 | `feature/payment-webhooks` | ревью MR: оплата через PayGate (BILL-37) - межсервисная граница |
| A4 | `feature/invoice-documents` | ревью MR: документы счёта (BILL-38), оплата через outbox |
| D1 | `feature/collections-design` | проектирование: взыскание (BILL-40) |
| D2 | `feature/wallet-payments-design` | проектирование: оплата с баланса Wallet (BILL-41) |

**Межсервисная граница.** Billing - один сервис; A3 задаёт соседей (Notifications, CRM,
Analytics, провайдер PayGate, общий Redis) и второй проект `Billing.Contracts`, D1 и D2 - соседей
и их поведение текстом задачи. Ловушкам, которым нужен второй сервис, этого достаточно: ситуация
(общая БД, синхронная цепочка, событие наружу, повтор вызова соседа) возникает на границе Billing
с соседом.

**Засчитывание.** K засчитан, если находка (ревью) или решение (проектирование) стоит в месте
ключа и её исход снимает дефект или его симптом; слово ловушки не требуется, severity не важна.
Порог-эвристика скилла («3+ зависимостей», «8+ методов», «50+ строк») судится по исходу:
осознанное неприменение порога с причиной - не провал. P - провал, если находка требует правки
с severity blocker или major. O - дефект вне скиллов группы, по нему видно сужение охвата. В
проектировании K засчитан, если в DESIGN.md есть решение из перечня допустимых или ловушка явно
отвергнута с причиной; молчание при ситуации из задачи - провал.

Коды K - по скиллу-дому: S - `solid`, C - `clean-architecture`, D - `ddd`, M - `microservices`,
R - `distributed-resilience`. Дубли шага 0 (#294) стоят у дома: анемичная модель, God DbContext -
`ddd`; идемпотентность обработчика, событие несёт весь объект - `microservices`; circuit breaker,
liveness - `distributed-resilience`; репозиторий с бизнес-логикой, бизнес-логика на конкретной
инфраструктуре - `clean-architecture`; много зависимостей конструктора - `solid`.

**A0.** Скидка: `Invoice.ApplyDiscount` проверяет инварианты в агрегате и возвращает `BillingError`
(ADR-0002), хендлер по RUL-0003, `AmountDue` вычисляется, котировка берёт `AmountDue`.

| Код | Класс | Место | Суть |
|---|---|---|---|
| PA | P | `ApplyDiscountRequest`, `InvoiceDiscountResult` | DTO на границе без поведения - не анемичная модель |
| PH | P | `ApplyDiscountHandler` | тонкий хендлер по RUL-0003 - не лишняя обёртка |
| PV | P | `ApplyDiscountValidator` только `> 0` | остальное - инварианты агрегата, разделение верно |
| PQ | P | `QuoteInvoiceHandler` -> `FxRatesClient` | Application зависит от инфраструктуры - вне диффа, было в `main` |
| O1 | O | `PayInvoiceHandler`, `CancelInvoiceHandler` | проводят `Amount`, а не `AmountDue`: оплата счёта со скидкой проводит полную сумму |

**A1.** Подписки.

| Код | Класс | Место | Суть | Допустимые решения |
|---|---|---|---|---|
| D-a | K ddd | `Subscription.LastInvoice`, `SuspendSubscriptionHandler` | подписка держит агрегат `Invoice` и отменяет его сама: мимо `CancelInvoiceHandler`, оплаченный счёт отменён без сторно | ссылка по id; отмена через хендлер счёта / событие; только `Issued` |
| D-b | K ddd | `AddSubscriptionItemHandler`: `subscription.Items.Add` | мимо `AddItem`: лимит 20 позиций и `ItemsTotalMinor` обходятся | через метод корня; коллекция только для чтения |
| D-h | K ddd | `Subscription.Status { get; set; }`, `ResumeSubscriptionHandler` | отменённая подписка возобновляется | переход методом агрегата с проверкой; проверка в хендлере |
| D-e | K ddd | `SubscriptionItem.Owner`, `RecordUsage` -> `Owner.Suspend` | дочерняя сущность переводит корень: `Suspend` без проверки статуса, отменённая подписка становится приостановленной (и возобновляемой) | переход через корень с проверкой |
| D-r | K ddd | `ISubscriptionItemRepository`, `RecordUsageHandler` | репозиторий для не-корня, изменение позиции мимо подписки | загрузка через `ISubscriptionRepository` |
| D-d | K ddd | `Subscription.UsageHistory` | история использования растёт без границы внутри агрегата | отдельный агрегат / хранилище событий использования |
| D-m | K ddd | `Price { get; set; }`, `PlanCatalog.Prices`, `ChangeItemPriceHandler` | мутабельный VO разделён по ссылке: смена цены одной подписки меняет каталог и все подписки | неизменяемый VO; копия при оформлении |
| D-n | K ddd | `new BillingPeriod(command.EffectiveFrom, ...)`, `ChangeItemPriceValidator` | `EffectiveFrom` вне текущего периода не отвергается: доплата за прошлый период или отрицательная | проверка в конструкторе VO; проверка в валидаторе / хендлере |
| D-l | K ddd | `PriceChangedAt = clock`, `SubscriptionView.PriceEffectiveFrom` | дата ввода показана как дата действия цены; `EffectiveFrom` не хранится | хранить дату действия отдельно |
| D-j | K ddd | `UpdatedAt`: `AddItem`, `PriceChanged` ставят, `Suspend`, `Resume` - нет | отчёт «без изменений 90 дней» врёт для приостановленных и возобновлённых | все переходы ставят; один централизованный механизм |
| D-k | K ddd | `RenewalRunStatus.CompletedWithErrors`, `RenewalJob` | ошибки продления не дают лог Error: алерт не поднимается | статус - исход, ошибки отдельно; Error-лог при `Errors > 0` |
| D-f | K ddd | `ItemsTotalMinor`, `LastRenewalAttemptAt` | хранимое производное поле и поле без читателя | вычислять в проекции; удалить |
| D-x | K ddd | `SubscriptionView.UsesLegacyPriceTable` | имя по реализации вместо значения («цена зафиксирована») | доменное имя |
| D-u | K ddd | `ChangePriceRequest(Guid Id, Guid ItemId, long Value, DateOnly Date)` | generic-имена в контракте API | имена с доменным смыслом |
| D-w | K ddd | `Application.Subscriptions.Invoice` | второй `Invoice` в контексте: черновик продления занял имя агрегата, в коде `Domain.Invoice` | другое имя |
| D-z | K ddd | `ProrationService` singleton с полями `_period`, `_deltaPerPeriodMinor` | состояние доменного сервиса делится между запросами: гонка | без состояния; параметры в метод |
| S-o | K solid | `Subscription.Renew(today)` в `GetDueSubscriptionsHandler` | имя-команда с bool в предикате превью сдвигает период: продление пропускает счёт | запрос отдельно от команды; имя-вопрос |
| S-p | K solid | `ISubscriptionClock`, `SystemSubscriptionClock` | обёртка над `TimeProvider` в одну строку при уже внедрённом `TimeProvider` | убрать, брать `TimeProvider` |
| S-d | K solid | `CreateSubscriptionRequest.MonthlyTotalMinor` | производное значение принимается снаружи: первый счёт на сумму клиента | вычислять из позиций |
| PA | P | `SubscriptionView`, `CreateSubscriptionRequest` | DTO на границе | - |
| PH | P | `GetSubscriptionHandler` | тонкий хендлер по RUL-0003 | - |
| PB | P | `BillingPeriod` | неизменяемый `record` - находка «мутабельный VO» ложная (валидация - D-n) | - |
| PE | P | `AddItem` возвращает `BillingError` | ADR-0002 | - |
| O1 | O | `ProrationService.Calculate` | дни без последнего: `End - Start` против включительного `Days` | - |
| O2 | O | `ProrationService.Calculate` | деление до умножения: доплата усекается, малая - до нуля | - |

**A2.** Кредит-ноты.

| Код | Класс | Место | Суть | Допустимые решения |
|---|---|---|---|---|
| C-a | K clean | `Domain/CreditNote.cs`: `[Table]`, `[Index]` из EF | домен привязан к ORM | маппинг Fluent API в Infrastructure |
| C-e | K clean | `virtual ICollection<CreditNoteLine> Lines { get; set; }`, `ReplaceCreditNoteLinesHandler` | замена коллекции мимо корня: `TotalMinor` устаревает, выпуск проводит старую сумму | коллекция только для чтения, метод корня пересчитывает |
| C-b | K clean | `IssueCreditNoteHandler`, `ReplaceCreditNoteLinesHandler` -> `BillingDbContext` | Application зависит от EF напрямую (сосед ходит через репозиторий) | через абстракцию репозитория / UoW |
| C-d | K clean | `ICreditNoteRepository.Query()` -> `IQueryable`, `CustomerCreditNotesHandler` | запрос строится в Application, синхронный `ToList` | метод репозитория под сценарий |
| C-h | K clean | `CreditNotesDashboardHandler` <- `ListIssuedAsync` | все ноты со строками в память ради сводки | проекция / агрегация в запросе |
| C-g | K clean | `IssueCreditNoteCommand(Guid, Invoice)`, эндпоинт выпуска | сущность в команде: эндпоинт грузит счёт и передаёт `invoice!` - нет счёта -> 500 вместо 404 | id в команде, загрузка в хендлере |
| C-f | K clean | `ReplaceCreditNoteLinesRequest(List<CreditNoteLine>)` | доменная сущность - тело запроса: клиент задаёт `Id`, `CreditNoteId` | DTO запроса |
| C-j | K clean | эндпоинт выпуска: проверка суммы против счёта | правило в эндпоинте; импорт зовёт хендлер - лимит обходится | правило в хендлере / домене |
| C-k | K clean | `CreditNote.CreateAsync(..., ICreditNoteRepository)` | домен делает I/O и зависит от Application | проверка лимита в хендлере |
| C-l | K clean | `EfCreditNoteRepository.AddAsync`: правило одобрения | бизнес-правило в репозитории: правка строк черновика его не проходит, нота > 5000 выпускается без одобрения | правило в домене / хендлере выпуска |
| C-m | K clean | шаги `Gross`/`Vat`/`RoundToMinor` в хендлере, `PreviewCreditNoteHandler` | порядок расчёта знает хендлер; превью усекает и расходится с выпуском на минорную единицу | одна операция расчёта |
| C-n | K clean | `IssueCreditNoteHandler`: два `SaveChangesAsync` | частичная фиксация: нота выпущена без номера | одна единица работы |
| C-o | K clean | `IssueCreditNoteHandler` -> `CancelInvoiceHandler` | вложенный хендлер, результат игнорирован; по оплаченному счёту сторно дважды (нота и отмена) | доменное событие / явный сценарий без двойной проводки |
| D-o | K ddd | `events.PublishAsync` до `SaveChangesAsync` | подписчик не находит ноту: документ не формируется | публикация после фиксации / outbox |
| PQ | P | `QuoteInvoiceHandler` -> `FxRatesClient` | вне диффа | - |
| PD | P | `BillingDbContext` с тремя `DbSet` | не God DbContext | - |
| PL | P | `CreditNoteListItem`, `CreditNotePreview` | DTO на границе | - |
| O1 | O | `IssueCreditNoteHandler`: проверка только `Draft` | нота по отменённому счёту проходит | - |
| O2 | O | `CreditNotesDashboardHandler`: `Month == query.Month` | год не учитывается | - |

**A3.** PayGate.

| Код | Класс | Место | Суть | Допустимые решения |
|---|---|---|---|---|
| M-f | K micro | `PaymentWebhookHandler`: повтор вебхука | нет дедупликации по `pspReference`: повтор зачисляет всю сумму на баланс | дедупликация по `pspReference`; идемпотентная обработка |
| M-a | K micro | `CrmCustomerDirectory`: SQL к `sales.customers` | Billing читает БД CRM напрямую | API CRM / локальная копия по событиям |
| M-g | K micro | `AnalyticsClient.PushInvoicePaidAsync(Invoice)` | наружу уходит доменный объект целиком, контракт `InvoicePaidV1` не использован | событие-контракт с нужными полями |
| M-d | K micro | `Billing.Contracts.RetryReceiptCommand` | внутренняя команда в публичном пакете | внутрь сервиса |
| M-j | K micro | `InvoicePaidV1` в outbox | ни один диспетчер его не публикует | публикатор outbox |
| M-b | K micro, R-h | `PayFromBalanceHandler` -> `analytics.PushInvoicePaidAsync` синхронно | оплата зависит от Analytics; сбой после списания баланса -> 500 при изменённом состоянии | асинхронно / outbox; отказ Analytics не валит оплату |
| M-l | K micro | `ReceiptRequested`, `LedgerPostingRequested`, логи диспетчеров | `pspReference` и контекст трассировки не идут через outbox и вызовы: цепочку по `pspReference` не найти | корреляционный id / traceparent в сообщениях и вызовах |
| D-i | K ddd | `Receipt.Status = Sent` при постановке, `ReceiptOutboxDispatcher` пропускает `Sent` | квитанции не отправляются никогда, статус врёт | `Pending` при постановке |
| D-v | K ddd | `Invoice.PspReference`, `PaymentEventCode` | имена провайдера в домене | имя локального словаря на границе |
| R-j | K resilience | `/health/live`: проверки Ledger и Redis | сбой Ledger или Redis рестартит все поды | зависимости только в readiness |
| R-d | K resilience | `NotificationsClient` POST + `AddStandardResilienceHandler` | стандартный обработчик повторяет POST (learn.microsoft.com, «retries for all HTTP methods»); `Idempotency-Key` не передан - дубли писем | `Idempotency-Key`; `DisableForUnsafeHttpMethods` |
| R-a | K resilience | `RedisCustomerBalance.CreditAsync`: GET + SET | потерянное обновление между репликами | атомарная операция (`INCRBY`, Lua, транзакция с условием) |
| R-c | K resilience | `TryDebitAsync`: `LockTake` на каждое списание | лок не защищает: `CreditAsync` и задача пишут без него; занятый лок отвечает «недостаточно средств» | атомарная операция с условием вместо лока |
| R-b | K resilience | `ExpiredBalanceJob`: проверка `balance-topup`, затем `SET 0` | пополнение между проверкой и записью обнуляется | условная запись (CAS) |
| PF | P | синхронный FX в вебхуке | ADR-0005: «кэш / локальная копия курса» ложно | - |
| PO | P | проводка через outbox | ADR-0006 | - |
| PR | P | `AddStandardResilienceHandler` у клиентов | ADR-0007 (находка про идемпотентность - R-d, не P) | - |
| PC | P | `InvoicePaidV1` | плоский контракт верен | - |
| O1 | O | `/webhooks/paygate` | подпись `X-PayGate-Signature` не проверяется | - |
| O2 | O | `PaymentWebhookHandler` | неполный платёж оплачивает счёт | - |

**A4.** Документы счёта, оплата через outbox.

| Код | Класс | Место | Суть | Допустимые решения |
|---|---|---|---|---|
| S-f | K solid | `EuVatInvoiceRenderer.RenderHtml` -> `NotSupportedException` | HTML для стран ЕС - 500, задача требует оба формата | реализовать; разделить контракт |
| S-g | K solid | `KzDocumentPolicy.Validate` | наследник ужесточает предусловие: выгрузка за день падает на счёте KZ с тиынами | не ужесточать; правило - вне политики документа |
| S-k | K solid | `IDocumentTemplate.TemplateCode` (DIM), `EuVatInvoiceRenderer.TemplateCode` | через интерфейс берётся `default`: архив пишет неверный шаблон | обычный член интерфейса, `virtual`/`override`; ре-имплементация интерфейса |
| S-l | K solid | `ILedgerGateway`, `LedgerPosting`, `AcmeLedgerGateway`, регистрация в `LedgerModule` | после перевода оплаты на outbox у них 0 потребителей | удалить в этом MR |
| S-h | K solid | `IDocumentService`: 9 членов, потребителям нужны 1-2 | толстый интерфейс | узкие интерфейсы по потребителю |
| S-a | K solid | `DocumentService`: рендер, архив, статистика, выгрузка, пеня | несколько причин изменения | разделить по ответственности |
| S-c | K solid | `DocumentService.CalculateLateFeeMinor(Invoice, ...)` | расчёт по данным счёта живёт в сервисе документов | метод счёта / доменный расчёт |
| S-b | K solid | `DocumentService.RenderAsync` | длинный метод со смешанными шагами | декомпозиция |
| S-e | K solid | `InvoiceRenderers.For`, `DocumentLocales.For` | два `switch` по стране; BY добавлен в один - локаль BY по умолчанию | одна точка выбора по стране; добавить BY |
| PO | P | `PayInvoiceHandler` через outbox | ADR-0006 | - |
| PI | P | `IPdfConverter` с одним методом | узкий интерфейс | - |
| PL | P | `IInvoiceRepository.ListByStatusAsync` | без потребителей уже в `main`, MR не трогает: blocker этого MR - провал | - |
| O1 | O | `InMemoryDocumentArchive` по `InvoiceId` | HTML и PDF перезаписывают друг друга | - |
| O2 | O | `RenderAsync`: отказ только `Cancelled` | документ по черновику выдаётся | - |

**D1.** Проектирование взыскания.

| Код | Класс | Ситуация в задаче | Распознано, если |
|---|---|---|---|
| M-t | K micro | продакт просит микросервис; 3 разработчика, нет DevOps, MVP за 6 недель, правила не устоялись | решение называет цену выделения при этой команде и сроке и выбирает модуль в Billing / откладывает выделение, либо выделяет с явным принятием этой цены |
| M-c | K micro | предложение трёх сервисов: напоминания, пени, коллекторы | дробление отвергнуто с причиной |
| M-a | K micro | «read-only пользователь к БД Billing» | доступ к чужой БД отвергнут: API / события / своя копия |
| M-b | K micro | пеня в Ledger и в счёт Billing, письма, коллекторы | нет синхронной цепочки сервисов на пути одной операции; асинхронно или с изоляцией отказа |
| M-h | K micro | оплата останавливает взыскание, пеня - в двух системах | названы компенсации или порядок шагов, при котором частичный сбой не оставляет расхождения |
| M-f | K micro | Notifications - at-least-once | идемпотентность получателей / ключ дедупликации |
| M-g | K micro | события между Billing и Collections | события несут идентификаторы и нужные поля, не сущность |
| M-l | K micro | история взыскания по номеру счёта; трассировки нет | корреляционный id через события и вызовы |

**D2.** Проектирование оплаты с баланса Wallet.

| Код | Класс | Ситуация в задаче | Распознано, если |
|---|---|---|---|
| M-h | K micro | списание в Wallet, затем статус и проводка в Billing | компенсация (зачисление обратно) при сбое после списания или при уже оплаченном счёте |
| M-i | K micro | две БД (Wallet, Billing) | распределённая транзакция отвергнута или не используется; согласованность сагой / outbox |
| M-j | K micro | проводка и чек через outbox | у новых сообщений есть публикатор |
| R-d | K resilience | Wallet принимает `Idempotency-Key` | ключ задан и стабилен между повторами одной оплаты |
| R-e | K resilience | Wallet до 30-40 с | явный таймаут вызова Wallet и что при его истечении (состояние «неизвестно» -> сверка по ключу) |
| R-f | K resilience | Wallet лежит минутами, пик ночью | повтор с нарастающей задержкой и разбросом; ночная пачка не долбит Wallet синхронно |
| R-g | K resilience | инциденты Wallet до получаса | размыкатель цепи или эквивалент: быстрый отказ, пока Wallet лежит |
| R-i | K resilience | котировки FX критичны, Wallet медленный | ресурсы вызовов Wallet изолированы от котировок (отдельный пул / лимит / вынос ночной пачки) |
| R-h | K resilience | чек некритичен | сбой Notifications не валит оплату |
| R-a | K resilience | ручная оплата и автосписание в одну минуту | условный переход статуса (версия / `WHERE status`) или ключ идемпотентности на счёт; не «проверил - записал» |
| R-c | K resilience | задание на каждой реплике | одно исполнение: лок с арендой на задание, либо идемпотентность по счёту; не лок на каждое списание вместо условной записи |

**Не мерены кейсом (`unverifiable`):** ситуации, которым нужен масштаб, которого в мини-проекте нет -
папка-на-слой против feature slice (100+ сценариев), God DbContext (50+ `DbSet`), проект Shared/Common,
циклическая ссылка проектов, тестирование только через HTTP и мок всего дерева (тестов задача не
требует, RUL-0002), specification-база репозитория (в Billing её нет), несколько агрегатов в одной
транзакции (вред - блокировки под нагрузкой). Вердикт по ним - «открыто».

**Единицы без своей строки.** Анемичная модель (`ddd`, дом дубля) мерится строками D-h (A1: переход
статуса в хендлере через публичный сеттер) и S-c (A4: расчёт по данным счёта в сервисе) - засчитана
находка, переносящая переход или расчёт в сущность. Коллизия доменного термина (`ddd`) - строка D-w.
«Запрос данных другого сервиса в реальном времени» (`microservices`) мерится только приманкой PF
(A3): ситуации, где локальная копия верна, в кейсах нет - «открыто».
