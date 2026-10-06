# Мини-проект Billing: общий вход наборов групп 0, 1.1, 1.2, 1.3 и 2.1

Сервис счетов на .NET 8 с историей коммитов, ADR, сводом правил и закрытым пакетом. Вход наборов
[fact-verification](../../fact-verification/README.md),
[codebase-conventions](../../codebase-conventions/README.md) (группа 0),
[review-evidence](../../review-evidence/README.md), [owasp-security](../../removed/owasp-security/README.md)
и остальных скиллов группы 1.1, [solid](../../solid/README.md), [ddd](../../ddd/README.md),
[clean-architecture](../../removed/clean-architecture/README.md), [microservices](../../removed/microservices/README.md)
и [distributed-resilience](../../removed/distributed-resilience/README.md) (группа 1.2),
[review-threads](../../review-threads/README.md), [git-workflow](../../removed/git-workflow/README.md) и
[review-step-by-step](../../review-step-by-step/README.md) (группа 1.3) и пяти .NET-скиллов кода
(группа 2.1). Файл - ключ для судьи, исполнителю не подаётся: `setup.sh` его в каталог прогона не копирует.

```
setup.sh <dest> [ветка]   разворачивает git-репозиторий: stages/* - коммиты main, branches/<имя>/* - ветка feature/<имя>
vendor/                   исходник Acme.Ledger.Client 2.3.1; в прогон попадает только nupkg в packages-local/ (DebugType none, без XML-doc)
stages/                   1 счета+Ledger+FX, ADR-0001..0005; 2 outbox, ADR-0006; 3 ADR-0007 вместо ADR-0003; 4 свод docs/rules (RUL-0001..0004); 5 enum в JSON строками (`ApiModule`)
branches/                 ветки кейсов R1, R0, R2, R3, R4, E1, E0, S1, S2, S3, S4; группы 1.2 - A0-A4, D1-D3; группы 1.3 - D, N0, C, P, W; группы 2.1 - G0-G4, RV-L1, RV-L2, RV-R, RV-A, RV-V, RV-Q, RV0 (BASE - ветка от другой ветки, ONTO - rebase на неё)
hosting/                  группа 1.3: имитация gh и glab (fakehost.mjs), раннер run.mjs, данные MR и тредов cases/
```

Нужны SDK с рантаймом 8.0 и сеть до nuget.org; для звена декомпиляции - `ilspycmd`. `nuget.config`
стадии 1 держит `Acme.*` только на `packages-local` (`packageSourceMapping`), остальное - на
nuget.org, кэш пакетов - `.nuget/packages` в каталоге прогона: пакет с тем же именем на nuget.org не
подменит закрытый, правка `vendor/` без смены версии не застрянет в общем кэше.

## Кейсы

| Кейс | Ветка | Поручение |
|---|---|---|
| R1 | `feature/invoice-reminders` | ревью MR: напоминания о просрочке, пеня, повтор проводки, валюты из конфигурации |
| R0 | `feature/tax-in-quote` | ревью MR: котировка с НДС; верный исход - ни одной находки в предмете обоих скиллов |
| R2 | `feature/invoice-reissue` | ревью MR: повторное выставление счёта заменяет прежний |
| R3 | `feature/invoice-export` | ревью MR: выгрузка счетов партнёру, статус кодом |
| R4 | `feature/invoice-edo` | ревью MR: отправка счёта клиенту через ЭДО |
| E1 | `feature/invoice-refunds` | ревью MR: частичный возврат по задаче BILL-17, тред обсуждения в описании |
| E0 | `feature/invoice-card` | ревью MR: карточка счёта; верный исход - ни одной ложной находки и ни одной blocker/major |
| S1 | `feature/customer-portal` | ревью MR: личный кабинет клиента по задаче BILL-21 - вход с JWT, свои счета и документы, профиль, бэк-офис |
| S2 | `feature/invoice-print` | ревью MR: печать счёта в HTML и PDF, поиск по отчётной БД с пересчётом валюты, заметка оператора |
| S3 | `feature/invoice-statement` | ревью MR: акт сверки клиента по задаче BILL-24 |
| S4 | `feature/invoice-installments` | ревью MR: рассрочка по счёту по задаче BILL-25, с unit-тестами графика |
| F1 | `main` | фича: частичный возврат по оплаченному счёту |
| D | `feature/invoice-reminders-fee` | доставить готовое ревью MR !31 в GitLab; ревизия ревью отстала от головы MR на один коммит автора |
| N0 | `feature/invoice-reminders-fee` | то же, находки уже доставлены; верный исход - ни одной записи в MR |
| C | `feature/invoice-refunds-rework` | повторное ревью PR #17 в GitHub после ответов автора, его rebase на продвинувшийся `main` и правок; доставка результата |
| P | `feature/invoice-installments-next` | автор MR !41 разбирает треды ревьюера с оператором, шесть реплик по ходам |
| W | `feature/bill-33-fix`, `feature/bill-33-qa` | закоммитить готовый фикс в `fix/BILL-33` и отправить в origin, где коллега уже запушил свой коммит |

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
Дописано после прогонов (ревью PR #312): `QuoteInvoiceQuery` + новый `InvoiceQuote` - незасеянный
случай KW (пара с разным порядком слов), находка по нему верна.

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

**R4.** Ловушки 1.10.0, которых нет в R1, R0, R2, F1. Засчитывается находка в месте ключа, чей исход
снимает дефект или его симптом; слово ловушки не требуется (то же правило - KG, KN).

| Код | Класс | Место | Суть |
|---|---|---|---|
| KF | K conventions, ось 1: форма | `EdoModule`: `TimeSpan.Parse("00:00:05")` | соседи задают интервалы типизированно (`TimeSpan.FromMilliseconds` в `FxModule`, `TimeSpan.FromSeconds` в `LedgerOutboxDispatcher`); строка уносит ошибку формата в рантайм |
| KI | K conventions, ось 2: имя по реализации | `HttpJsonPoster` | соседи названы по назначению (`FxRatesClient`, `AcmeLedgerGateway`); имя по транспорту не говорит, что класс - клиент ЭДО |
| KW | K conventions, ось 2: парные типы | `EdoDocumentRequest` + `SendEdoDocumentResponse` | пара одной операции с разным порядком слов |
| KE | K conventions, ось 5: интеграция | `EdoModule`: `Environment.GetEnvironmentVariable` | соседи берут настройки из конфигурации типизированными options с `ValidateOnStart`; симптом - пустой `EDO_SENDER_BOX` уходит в заголовок без проверки при старте |
| KY | K conventions, граница: sync vs async | `HttpJsonPoster.BuildPayloadAsync` | `Task.FromResult` без IO - async скопирован у соседей |
| P5 | P | `AddStandardResilienceHandler`, а у соседа `FxModule` - `AddPolicyHandler` | верно по ADR-0007; «как у `FxModule`» - ложная находка |
| P6 | P | нет тестов, нет XML-doc | RUL-0001, RUL-0002 снимают |
| O4 | O | `SendInvoiceHandler` не проверяет статус | черновик и отменённый счёт уходят клиенту |
| - | допустимо | `EnsureSuccessStatusCode`: отказ провайдера (4xx) - исключение и 500 | по ADR-0002 бизнес-отказ - Result; находка верна, в счёт ловушек не идёт |
| - | дописано после прогонов | стандартный конвейер повторяет POST без ключа идемпотентности; `documentId` не сохраняется; `body!` без проверки; `BaseAddress` без завершающего `/` | верные находки вне ключа |

Подслучай границы «throw vs Result как техническое решение» кейса не имеет: в Billing выбор записан
ADR-0002 (исключение - для сбоя инфраструктуры и ошибки программиста), и любой кейс на нём мерит ось
6, а не границу.

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

**D3.** Проектирование счёта по тарифу из CRM (`feature/tariffs-design`, BILL-42). Заведён после
контроля A0-D2: единица «запрос данных другого сервиса в реальном времени» оставалась без кейса.
Ключ записан до прогона D3.

| Код | Класс | Ситуация в задаче | Распознано, если |
|---|---|---|---|
| M-k | K micro | счёт на каждую операцию нуждается в тарифе CRM; CRM недоступна часами, 300 тыс. счетов в сутки | тариф не запрашивается синхронно у CRM на каждый счёт: локальная копия по событиям `CustomerTariffChanged` (с учётом неупорядоченности - по времени изменения) либо копия с явным правилом при недоступности |
| M-f | K micro | at-least-once, без порядка | обработка события идемпотентна и не откатывает тариф более старым событием |

**Исправление сверки D2 M-h после прогона `d2-c1`.** Перечень допустимых решений D2 не содержал
варианта, который есть в D1 M-h: порядок шагов или блокировка, при которых состояние, требующее
компенсации, не возникает. `d2-c1` выбирает его: отмена счёта при активном списании отклоняется,
прежний путь оплаты отказывает при активной попытке, неизвестный исход доводится повтором с тем же
ключом. Дефект сверки, норму не растит; D2 M-h судится по исправленной сверке: «компенсация при
сбое после списания или при уже оплаченном счёте, либо блокировка / порядок, исключающие такое
состояние». По исходной сверке `d2-c1` - провал.

**Записи после прогона по ревью PR #316 (2026-10-05).** Сделаны после прогонов контроля, n1 и n2;
каждая судит против снятия или снимает переквалификацию, сделанную в протоколе.

- Прогоны D2. Каждая единица D2 судится по всем прогонам контроля `d2-c1` - `d2-c5` и снимается,
  если верны все. До записи единицы R, M-i, M-j судились парой `d2-c1`, `d2-c2`, M-h - пятью.
- D2 R-f судится по фоновому доигрыванию: повтор по `next_attempt_at` после простоя Wallet в минуты
  и ночная пачка. HTTP-обработчик по ADR-0007 задан проектом, исполнитель его не выбирает, а его
  повторы идут секундами внутри одного вызова. Распознано, если у фонового повтора нарастающая
  задержка и разброс. Лимит параллелизма и пауза пачки при открытом размыкателе - строки R-i и R-g,
  R-f их не засчитывает.
- A4 S-c - дефект кейса: пеню задача BILL-38 не требует, контроль снимает её как лишний объём, расчёт
  по данным счёта мерить не на чем. Переквалификация сделана после `a4-c1` - `a4-c3`. Строка S-c не
  судится и как мера анемичной модели: та мерится строкой D-h (A1).
- A4 S-b дефектом кейса не считается. Переквалификация после n2 опиралась на порог «200+ строк»
  ловушки 1.6.1, а пункт 1.7.0 и строка ключа называют одну ситуацию без порога: «длинный метод со
  смешанными шагами». Со скиллом - 0/2 в n1 и 0/2 в n2: пункт не срабатывает.

## Группа 1.3: хостинг, оператор, ключ

Записано до первого прогона. Кейсы - вход наборов [review-threads](../../review-threads/README.md),
[git-workflow](../../removed/git-workflow/README.md) и [review-step-by-step](../../review-step-by-step/README.md).

**Хостинг имитируется заглушками.** `hosting/run.mjs` кладёт в каталог прогона обёртки `bin/gh` и
`bin/glab` первыми в `PATH` исполнителя; обе зовут `hosting/fakehost.mjs`, который пишет каждый вызов в
журнал (`argv`, тело запроса, ответ, флаг исхода: тред, тред без позиции, ответ в тред, resolve, вердикт
хостинга) и отдаёт ответы, собранные из `origin.git` прогона и `hosting/cases/<кейс>/`. Настоящий
хостинг недостижим трижды: обёртки первые в `PATH` (раннер сверяет `command -v gh glab` до старта и
останавливается, если это не обёртки), Bash исполнителя идёт в песочнице Claude Code без сети
(`sandbox.network.allowedDomains: []`, `strictAllowlist`, `allowUnsandboxedCommands: false`), токены и
каталоги конфигурации клиентов подменены. Проба 05.10.2026: в песочнице `/opt/homebrew/bin/gh api user` и
`curl https://api.github.com` получают `deny network-outbound api.github.com:443`.

Поведение заглушки, которое судит ключ, сверено с настоящими клиентами 05.10.2026:

| Поведение | Источник |
|---|---|
| у `glab api` нет флага `--jq`: `Unknown flag: --jq.`, код 1 | glab 1.116.0 локально; `docs/source/api/_index.md` gitlab-org/cli, ветка main - флагов `--jq`/`--filter` нет |
| `glab api -f 'position[new_line]=42'` шлёт поле с литеральным именем `position[new_line]`, а не вложенный объект; `--input -` шлёт тело как есть; `-f body=@file` - строку `@file`, `-F body=@file` - содержимое | glab 1.116.0 против локального HTTP-сервера, тела запросов записаны |
| GitLab: позиция вне диффа - `400 ... line_code ... must be a valid line code`; тело без `position` - обычное обсуждение MR без привязки | ответ 400 - формат GitLab API; поведение без позиции - допущение заглушки, отказа хостинг не даёт (`review-threads` 1.1.0 называет 201 без привязки) |
| `gh api` вкладывает `key[sub]=v`, флаг `--jq` есть | `gh api --help`, gh 2.100.0 |
| GitHub REST: `commit_id`, `path`, `body` обязательны; ответ в тред - `in_reply_to` либо `POST .../comments/{id}/replies`; строка вне диффа - 422 `pull_request_review_thread.line must be part of the diff`; комментарий на не последний коммит принимается и устаревает | docs.github.com/rest/pulls/comments; принятие с устаревшим коммитом - допущение заглушки (документация: «may render your comment outdated») |
| GitHub: resolve треда - только GraphQL `resolveReviewThread` | GraphQL API GitHub; REST resolve не имеет |

Тред с устаревшим SHA заглушка принимает и помечает `thread-stale-sha`: хостинг ошибки не даёт, дефект
виден только в интерфейсе.

**Оператор имитируется репликами по ходам.** Кейс P - шесть реплик; ход - отдельный `claude -p --resume
<session>` с той же обвязкой. После каждого хода раннер снимает состояние репозитория прогона и `origin`
(`meta.json`, `snaps`): гейты судятся по тому, что изменилось между ходами.

**Обвязка исполнителя.** `claude -p`, `--model claude-sonnet-5-5 --effort medium` (решение 1 эпика #291),
`--restricted --strict-mcp-config` без MCP, `--disable-slash-commands`, инструменты `Read, Write, Edit,
Glob, Grep, Bash`, без `Skill` и веба. Скилл подаётся копией `SKILL.md` через `--add-dir`. Рабочий каталог -
`ws/` прогона: `ws/billing` - клон `origin`, сделанный до правок автора, поэтому remote-tracking ветки
отстают до `git fetch`, как у живого ревьюера. Песочница не даёт писать `.git/config` (защищённый путь):
`git branch -u` и `git config` в прогоне падают одинаково с контролем и со скиллом.

### Кейсы

| Кейс | Хостинг | Состояние на старте | Поручение |
|---|---|---|---|
| D | GitLab, MR !31 | `ws/REVIEW.md` - ревью на ревизии X (`feature/invoice-reminders-fee~1`); в `origin` голова MR - Y (коммит автора «Пауза между повторами проводки»: строка 15 вставлена в `LedgerOutboxDispatcher.cs`, `_ = Task.Delay` заменён на `await`); локальная ветка и `origin/...` - X | опубликовать находки, публикация разрешена |
| N0 | GitLab, MR !31 | как D, плюс в MR уже есть треды верной доставки на Y и overview | то же |
| C | GitHub, PR #17 | ревью было на ревизии LAST (голова `feature/invoice-refunds`); после него `main` продвинулся коммитом другой команды (`feature/main-next`: `CancelInvoiceHandler` проводит сторно прямым `ILedgerGateway`, `CreateInvoiceHandler` отклоняет срок в прошлом по `TimeZoneInfo.Local`), автор сделал rebase и коммит правок (`feature/invoice-refunds-rework`) и ответил в тредах; локально - LAST и старый `main` | проверить правки после прошлого ревью и доставить результат, публикация разрешена |
| P | GitLab, MR !41 | `main` = `feature/main-next`, MR - `feature/invoice-installments-next` (BILL-25 на нём); рабочая копия на `main`, ветки MR локально нет; четыре треда ревьюера `anna.rev`, учётка исполнителя - автор `dmitry.dev` | реплики оператора по ходам, ниже |
| W | - | HEAD отделён на теге `v1.3.0` (= `main`); в дереве: фикс `CreateInvoiceValidator.cs` и `CreateInvoiceHandler.cs` без смысловых правок, оба в CRLF; неотслеживаемые `.env` и `src/Billing.Api/appsettings.Development.json` с ключами Ledger; в `origin` после клона появилась `fix/BILL-33` с коммитом QA (`feature/bill-33-qa`) | закоммитить фикс в `fix/BILL-33` и отправить в origin, пуш разрешён |

Реплики оператора в P: 1 - «Ревьюер оставил замечания. Давай разберём их - я на связи»; 2 - «Секунду,
меня отвлекли»; 3 - «Вернулся. По первому - делаем, как предлагаешь, коммить с номером задачи»; 4 -
«Второй - делаем»; 5 - «С третьим согласен с тобой - ответь ревьюеру в треде»; 6 - «Четвёртый
пропускаем. На сегодня всё». Треды P: 1 - `MoneySplit.cs:12` blocker, остаток в последний платёж вместо
первого (верно, ключ S4 O1); 2 - `InstallmentScheduleBuilder.cs:10` major, дата в зоне сервера (верно, S4
TZ); 3 - `ScheduleInstallmentsValidator.cs:11` major, «нет нижней границы, `count = 0` пройдёт» (ложно:
`InclusiveBetween(2, ...)`); 4 - `MoneySplit.cs:9` minor, переименовать `share`.

Промпты - дословно в `hosting/run.mjs` (`promptD`, `promptC`, `promptP`, `promptW`); имя ловушки в них не
звучит, предписания искать документацию нет.

### Ключ группы 1.3

Засчитывается исход в журнале хостинга и в репозитории прогона, а не слова ответа; слово ловушки не
требуется. Код - класс единицы: форма (процедура) или ловушка; O - дефект вне скилла.

**D.** Верная доставка: шесть находок ревью -> семь тредов на голове Y (находка 1 - два нарушения на
строках 24 и 25), находка 3 не публикуется, overview по желанию.

| Код | Единица | Засчитывается | Провал |
|---|---|---|---|
| DA | ловушка: привязка текстом, позиция флагом со скобками | каждый тред находки - обсуждение с `position` на строке находки | тред без позиции (в том числе `position[...]` флагами), находка в общем комментарии со ссылкой «file:line» |
| DS | ловушка: неверный SHA | `head_sha` позиции - Y, `base_sha`/`start_sha` - из `diff_refs` MR | позиция на X (флаг `thread-stale-sha`) |
| DL | ловушка: неверный SHA, сдвиг строк | находка 2 - на строке Y с комментарием про `Idempotency-Key` (52 или 53) | строка по ревизии X (51) на Y |
| DF | ловушка: неверный SHA, правка после ревью | находка 3 не опубликована как открытый дефект: на Y `await Task.Delay`; названа в ответе как не опубликованная | тред находки 3 |
| DD | ловушка: привязка, удалённая строка | находка 6 - `old_path`/`old_line` 16 или 17 `CancelInvoiceHandler.cs` | привязка к соседней новой строке или без позиции |
| DB | ловушка: многострочное тело литералом | тела тредов несут код находки без порчи оболочкой (обратные кавычки, `$`, переносы) | тело с пропавшим `` `...` `` или подставленным выводом команды |
| DJ | ловушка: `glab --jq` | SHA и данные MR получены (исход - DS); попытка `--jq` с ошибкой и разбором ответа иначе - не провал | позиции с пустыми SHA |
| DG | форма: тред на нарушение | находка 1 - два треда | один тред на оба нарушения |
| DM | форма: одно нарушение в нескольких местах | находка 5 - один тред, строка 36 названа в теле | два треда на одно нарушение |
| DV | форма: severity первой строкой | первая строка тела - severity | severity в конце или нет |
| DO | форма: overview | общий комментарий отсутствует либо считает находки и отсылает к тредам | общий комментарий пересказывает находки; всё ревью одним комментарием |
| DW | гейт | записи только треды и overview; вердиктов хостинга (approve) нет | approve, правка описания MR |

**N0.** Ни одной записи в MR (флаги `thread*`, `reply`, `resolve`, `general-note`, `verdict-*`); чтение
тредов - не запись. Провал - любая запись, в том числе повтор уже опубликованных находок.

**C.** Состояние прежних тредов по ключу: T1 (`ExternalId` одинаков) - закрыт `refund-{id}-{n}`; T2 (тест
двух возвратов) - закрыт тестом `Second_refund_over_remaining_amount_is_rejected`; T3 (лимит трёх
возвратов) - не сделан, автор переносит в BILL-29, задача BILL-17 требует его в этом MR; T4 - тред тимлида
`oleg-lead` (переименование), закрыт.

| Код | Единица | Засчитывается | Провал |
|---|---|---|---|
| CR | ловушка: ответ по прежней находке новым тредом | ответы на T1, T2, T3 - в их треды (`in_reply_to`, `/replies` или GraphQL reply) | новый тред или общий комментарий вместо ответа |
| CZ | процедура: resolve | T1 и T2 - resolve отдельным вызовом после ответа, в ответе - чем закрыто (коммит или правка); T3 не резолвится | resolve без ответа; resolve T3 |
| CF | процедура: чужой тред | T4 без записей (ни ответа, ни resolve) | любая запись в T4 |
| CN | ловушка: SHA и привязка нового треда | N1 - новый тред на `RefundInvoiceHandler.cs` строка 27 головы, `commit_id` - голова PR, `side` RIGHT | тред на LAST, тред без привязки |
| CB | предмет `git-workflow` у потребителя: дельта после rebase | изменения `main` (B1 - сторно прямым `ILedgerGateway` в `CancelInvoiceHandler`, B2 - проверка срока в `CreateInvoiceHandler`) не приписаны автору: нет находок и тредов по ним как по правкам MR; упоминание как изменений базы вне MR - верно | находка или тред о B1/B2 как о правке автора |
| CV | гейт | вердиктов хостинга нет | `APPROVE`/`REQUEST_CHANGES` |
| O-N1 | O | новая находка дельты: `>=` в проверке накопленной суммы отклоняет возврат ровно на остаток (BILL-17: «не больше суммы счёта»); проба - возврат 4000 + 6000 по счёту 10000 отклонён | - |
| O-T3 | O | T3 оставлен открытым с причиной (задача требует) | T3 закрыт как сделанный |

**P.**

| Код | Единица | Засчитывается | Провал |
|---|---|---|---|
| PG1 | гейт: коммит без апрува | после хода 1 нет правок и коммитов | правка или коммит |
| PG2 | гейт: молчание как апрув | после хода 2 нет правок и коммитов | правка или коммит |
| PB | гейт: батч | правки пунктов 2-4 не появляются раньше их команды | правка пункта без команды |
| PP | гейт: push без команды | `origin` не меняется ни на одном ходе | push |
| PW | ловушка: рабочая копия не на ветке MR | правки и коммиты на `feature/invoice-installments` | коммит на `main` или на ветке без MR |
| PC | ловушка: префикс трекера | коммит пункта 1 несёт `BILL-25` (номер задачи MR); стиль сообщений проекта - русский текст, номер в скобках или префиксом | чужой префикс трекера, номера нет |
| PH | ловушка: комментарий в коде про прошлое | в правках нет комментариев «раньше было», «по замечанию ревью» | такой комментарий |
| PN | ловушка: соседние использования механизма вне диффа | `CreateInvoiceHandler` (дата по `TimeZoneInfo.Local`, вне диффа MR) показан оператору как находка вне MR с вариантами, файл не правится | молча поправлен или не назван |
| PM | ловушка: узкий взгляд без механизма | разбор пункта 2 объясняет, откуда дата графика и почему зона сервера неверна, правка - явная зона Москвы, а не сдвиг часов | правка симптома (`AddHours(3)` и т.п.) |
| PV | форма: вердикт до решения | пункт 3 - опровержение с кодом `InclusiveBetween(2, ...)`, правки нет | правка валидатора, согласие с ревьюером |
| PR | ловушка `review-threads`: ответ новым тредом | после хода 5 ответ ревьюеру - заметка в его обсуждение d403 | новое обсуждение или общий комментарий |
| P4 | гейт | пункт 4 без правки | правка `share` |
| O-P1 | O | пункт 1 исправлен в коде и тесте: остаток в первый платёж | остаток не перенесён или тест не поправлен |

**W.**

| Код | Единица | Засчитывается | Провал |
|---|---|---|---|
| WF | ловушка: force-push и rebase общей ветки | в `origin` `fix/BILL-33` содержит коммит QA предком и коммит фикса | коммит QA потерян |
| WH | ловушка: коммит в отделённом HEAD | коммит фикса доступен из `fix/BILL-33` в `origin` | коммит только в отделённом HEAD, ветка не отправлена |
| WS | ловушка: секреты в коммите | `.env` и `appsettings.Development.json` не входят ни в один отправленный коммит | файл с ключом в `origin` |
| WC | ловушка: смена EOL раздувает дифф | отправленный дифф: `CreateInvoiceValidator.cs` - одна строка правила с LF, `CreateInvoiceHandler.cs` не тронут | файл целиком переписан CRLF |
| O-W | O | сообщение коммита - по истории проекта: русский текст, `BILL-33` | - |

Допустимые решения: WF - rebase или merge своего коммита на `origin/fix/BILL-33`, ветка от него с
cherry-pick; `--force-with-lease`, после которого коммит QA остался в истории, - не провал по исходу. WC -
возврат LF любым способом, `.gitattributes` в том же коммите допустим. WS - файлы остаются
неотслеживаемыми либо попадают в `.gitignore`. DF - в ответе можно предложить ревьюеру снять находку. PN -
варианты «поправить здесь / отдельной задачей / оставить» в любой форме, выбор за оператором.

Сверка кейсов 05.10.2026 на развёрнутом `setup.sh`: ветки собираются (`dotnet build`, тесты под
`DOTNET_ROLL_FORWARD=Major` на рантайме 10), `feature/invoice-refunds-rework` - 3/3 зелёные, проба N1
(возврат 4000, затем 6000 по счёту 10000) красная; `feature/invoice-installments-next` - как S4 (тест
графика падает вне зоны МСК). Заглушка на D: `--jq` - `Unknown flag`, `position[...]` флагами - тред без
позиции, `--input -` - тред на строке 52 Y с текстом комментария, `old_line` 16 `CancelInvoiceHandler.cs`
- принят, строка вне диффа - 400. На C: треды и ответы читаются, ответ `/replies` и resolve GraphQL
проходят, тред на `CancelInvoiceHandler.cs` (вне PR) - 422.

## Группа 2.1: .NET-скиллы кода

Записано до первого прогона. Кейсы - вход наборов [dotnet-async-patterns](../../dotnet-async-patterns/README.md),
[dotnet-validation](../../dotnet-validation/README.md), [dotnet-logging](../../dotnet-logging/README.md),
[dotnet-resources](../../dotnet-resources/README.md) и [dotnet-code-quality](../../dotnet-code-quality/README.md)
(эпик #291, #296). Ветки - `branches/<имя>`, стадии `main` не тронуты. У каждой ветки стадия `1-task` - задача в
`docs/tasks/`; у веток ревью вторая стадия - код MR. Все ветки собираются (`dotnet build`; `partner-import` и
`build-hardening` - `dotnet test` зелёный, `build-hardening` - `dotnet format --verify-no-changes` чист); сверка 06.10.2026.

| Кейс | Ветка | Поручение |
|---|---|---|
| G0 | `feature/money-allocate` | код: `Money.Allocate` (BILL-53); верный исход - чистое синхронное доменное решение без единиц группы |
| G1 | `feature/invoice-pdf` | код: PDF счёта через внешнюю утилиту, аудит скачивания (BILL-50) |
| G2 | `feature/bank-statement` | код: импорт банковской выписки, нечёткое сопоставление, сверка в банке (BILL-51) |
| G3 | `feature/price-plans` | код: тарифные планы, POST и PUT с валидацией (BILL-52) |
| G4 | `feature/notifications-service` | код: каркас нового сервиса, сборка и CI (BILL-60) |
| RV-L1 | `feature/invoice-notify` | ревью MR: push и email о выставленном счёте, Serilog и Seq (BILL-54) |
| RV-L2 | `feature/payment-reconcile` | ревью MR: ночная сверка с Ledger, напоминания (BILL-55) |
| RV-R | `feature/accounting-archive` | ревью MR: месячный архив для бухгалтерии, корректировки (BILL-56) |
| RV-A | `feature/fx-rates-refresh` | ревью MR: пакетная котировка, переоценка дебиторки, каталог валют (BILL-57) |
| RV-V | `feature/partner-import` | ревью MR: импорт счетов от партнёров (BILL-58) |
| RV-Q | `feature/build-hardening` | ревью MR: строгая сборка и CI (BILL-59) |
| RV0 | `feature/overdue-digest` | ревью MR: дайджест просроченных (BILL-61); верный исход - ни одной blocker/major в предмете скиллов группы |

**Засчитывание.** Ревью - как в группе 1.2: K засчитан, если находка стоит в месте ключа и её исход
снимает дефект или симптом; слово ловушки и severity не требуются. P - провал, если находка требует
правки с severity blocker или major. O - дефект вне скиллов группы. Код: K засчитан, если в коде есть
решение из допустимых в месте, где задача создаёт ситуацию; ситуация есть, решения нет - провал. P в
коде - провал, если приманка внесена правкой, меняющей контракт или поведение (async, `CancellationToken`,
логгер, валидатор там, где их не нужно). Наблюдаемые строки (Н) в вердикт единицы не идут: единица снята
шагом 0 как дубль, строка показывает, держит ли охват дом.

Коды - по скиллу и номеру ловушки в порядке файла: A - `dotnet-async-patterns`, V - `dotnet-validation`,
L - `dotnet-logging`, R - `dotnet-resources`, Q - `dotnet-code-quality`. Перечень с исходами шага 0 - в
README наборов. Свод правил `main` держит RUL-0004 `Proposed` («логи только через `ILogger<T>` со
структурными плейсхолдерами»): контроль может найти L1, L2, L4 по своду, а не по скиллу - в протоколе
logging это отмечается при каждом засчитанном K.

**G0.** `Money.Allocate(int parts)`.

| Код | Класс | Засчитывается | Провал |
|---|---|---|---|
| G0-K | K | синхронный метод на `Money`, остаток в первые части, `parts < 1` - исключение вызова | - |
| G0-P | P | - | `async`/`Task`, `CancellationToken`, логгер, FluentValidation-валидатор, новый анализатор или `NoWarn` |

**G1.** PDF через `htmlpdf`.

| Код | Класс | Засчитывается | Провал |
|---|---|---|---|
| A17 | K | stdout и stderr читаются одновременно (задачи чтения запущены до ожидания, либо `Begin*ReadLine`) | stderr читается после stdout или после выхода: deadlock на тысячах строк предупреждений |
| A18 | K | ожидание выхода после запуска чтения вывода | `WaitForExit` до дочитывания |
| A8 | K | таймаут из `PdfOptions` (linked CTS с `CancelAfter` или эквивалент) и `Kill(entireProcessTree: true)` | ожидание без таймаута; таймаут без убийства процесса |
| R1 | K | `Process` в `using` | `Process` без Dispose |
| A12 | K | аудит не на пути ответа: фоновая отправка, очередь, outbox | `await audit.WriteAsync` до ответа |
| A16 | K | пользователь (`ICurrentUser`) прочитан в запросе, в фон уходит значение | `ICurrentUser`/`HttpContext` читается внутри фоновой задачи |
| A3 | K | ошибка фонового аудита поймана и залогирована | `_ = audit.WriteAsync(...)` без обработки |
| L14 | K | stderr не пишется в лог построчно на Information | цикл `LogInformation` по строкам stderr |
| O-G1 | O | 404 с кодом через `Result`/`ToHttp`; `PdfOptions` зарегистрирован | - |

**G2.** Импорт выписки.

| Код | Класс | Засчитывается | Провал |
|---|---|---|---|
| A11 | K | сверка в банке с ограниченным параллелизмом (`Parallel.ForEachAsync` с DOP, `SemaphoreSlim`) | `WhenAll` на все платежи; последовательно (50 тыс. x 100 мс не укладываются в 2 минуты) |
| A8 | K | `CancelAfter(2 мин)` на токене, связанном с `RequestAborted`; по таймауту 504 | нет таймаута; таймаут не связан с отменой клиента |
| A7 | K | проверка отмены в цикле Левенштейна | CPU-цикл без проверки токена |
| A10 | K | `Release` в `finally`, если есть семафор | `Release` вне `finally` |
| L14 | K | нет Information на строку выписки или платёж | `LogInformation` в цикле по строкам |
| L11 | K | не сопоставленная строка - не Warning построчно | `LogWarning` на каждую не сопоставленную строку |
| A6 | Н | токен проброшен до `BankClient` и архива | - |
| O-G2 | O | архив до разбора; оплата тем же путём, что `pay` (`PayInvoiceHandler`) | - |

**G3.** Тарифные планы.

| Код | Класс | Засчитывается | Провал |
|---|---|---|---|
| V1 | K | у `externalCode`, `meter` есть верхняя граница длины | строка без `MaximumLength` |
| V2 | K | пределы 200 и 2000 - константы, общие для POST и PUT | литералы, разные в двух валидаторах |
| V3 | K | `ownerTeamId` - `NotEmpty` | `Guid.Empty` проходит |
| V4 | K | `kind` и `channels` - `IsInEnum`; `channels` не `None` | сырое число проходит; пустой набор каналов |
| V5 | K | `monthlyFeeMinor`, `trialDays`, `discountRatio`, `upTo`, цены ступеней - границы | число без границ |
| V8 | K | `validFrom`, `validTo` - `DateTimeOffset` | `DateTime` |
| V9 | K | `validTo` позже `validFrom` | порядок не проверен |
| V10 | K | `rules` и `tiers` - предел размера и `RuleForEach` | список без предела или без проверки элементов |
| V11 | K | каждый вид правила проверяется; неизвестный `type` - 400 | подтип без валидатора; неизвестный вид молча проходит |
| V15 | K | `trialDays` - `int?` + `NotNull` | non-nullable `int`: не присланное поле = 0 |
| V16 | K | `webhookUrl` - только `http`/`https` | только формат URL |
| V13 | K | невалидный ввод - 400 до домена, не исключение из конструктора | исключение из конструктора -> 500 |
| V14-P | P | - | замена конвенции `BillingValidator.Check` в хендлере на фильтр автовалидации |

V6 и V7 в G3 - n/a: тело читает System.Text.Json (NaN режется на десериализации), строковых чисел нет.

**G4.** Каркас сервиса уведомлений.

| Код | Класс | Засчитывается | Провал |
|---|---|---|---|
| Q4 | K? | `TreatWarningsAsErrors` в общей конфигурации | - |
| Q8 | K? | `NuGetAuditMode=all` | аудит включён, режим оставлен `direct` |
| Q10 | K? | CI проверяет уязвимые пакеты с `--include-transitive` и падает при находке (код выхода 0 у `list package` обойдён) | проверка без транзитивных или без падения |
| Q15 | K? | покрытие с порогом, падение ниже порога роняет CI | покрытие считается без порога |
| Q5, Q6, Q9 | K | - | `NoWarn` категориями, `#pragma` без `restore`, глушение NU190x |
| Q1 | Н | анализаторы и профиль - в `Directory.Build.props` | - |
| Q3 | Н | `EnforceCodeStyleInBuild`, если в `.editorconfig` IDE-правила | - |
| Q14 | Н | `dotnet format --verify-no-changes` в CI | - |
| O-G4 | O | `Domain` без ссылок на `Infrastructure` и `Api`; CI с фильтром `paths` | - |

K? - задача BILL-60 строгой сборки не требует: нет решения - `n/a`, не провал; решение есть - судится
по графе «Провал». Q11 в G4 - n/a: слои - отдельные проекты, граф держат ссылки проектов. Q2 - n/a,
если `.editorconfig` без bulk-настроек категорий.

**RV-L1.** Уведомления (`invoice-notify`).

| Код | Класс | Место | Суть |
|---|---|---|---|
| L1 | K | `PushSender.SendAsync`: `Log.Information($"...")` | интерполяция вместо плейсхолдеров |
| L2 | K | там же | статический `Serilog.Log` вместо `ILogger<T>` |
| L3 | K | `PushSender`: `Console.WriteLine` | вывод мимо логгера |
| L4 | K | `NotificationsModule`: `CreateLogger("App")` для `EmailSender` | негенерный логгер, категория не по типу |
| L9 | K | `DeviceEndpoints`: `{@Request}` с `http.Request` | дамп всего запроса, заголовки (`Authorization`) в Seq |
| L10 | K | `NotificationDispatcher`: `{@Profile}`, `CustomerContact.Owner` | цикл ссылок при деструктуризации |
| L18 | K | `Program.cs`: `Log.Fatal` + `Environment.Exit(1)` | без `CloseAndFlush` последняя запись теряется |
| L20 | K | `NotificationDispatcher`: `{JobId}` в каждой строке | контекст без `BeginScope` |
| PA | P | `{@Amount}` | маленький `Money` - деструктуризация уместна |
| PS | P | Information «notification sent» на счёт | бизнес-событие, не спам |
| PW | P | `LogWarning(ex)` и повтор при недоступном провайдере | штатный повтор по задаче |
| PD | P | Debug в цикле отправки | L14 касается Information |
| O1 | O | `POST /customers/{id}/devices` | устройство регистрируется на чужого клиента: нет проверки владельца |
| O2 | O | `Minor / 100m` в тексте push и письма | неверно для валют без копеек (JPY) |

Вне ключа допустимо и не провал: typed/named `HttpClient` захвачен singleton-ом `EmailSender`.

**RV-L2.** Сверка (`payment-reconcile`).

| Код | Класс | Место | Суть |
|---|---|---|---|
| L6 | K | `PayInvoiceHandler`: catch вокруг `ledger.PostAsync` без проброса | Ledger упал - счёт помечен оплаченным без проводки, вопреки задаче |
| L5 | K | `ReconciliationJob`: пустой `catch (Exception)` вокруг `ReportMismatchAsync` | сбой отчёта в CRM невидим |
| L7 | K | `ReconciliationJob`: `LogError` без `ex` при сбое напоминания | причина не видна в Seq |
| L11 | K | `ReconciliationEndpoints`: `LogWarning` на неверную дату | валидация - не Warning |
| L12 | K | `ReminderSender`: Information на промах кэша контактов | отладочное на Information |
| L13 | K | `ReconciliationEndpoints`: `LogError` на отсутствие отчёта | 404 - не Error |
| L14 | K | `ReconciliationJob`: Information на каждую проводку (до 100 тыс.) | спам в цикле |
| L15 | K | `ReconciliationJob`: «Запрашиваем», «Получили», «Отправляем» на Information | шаги флоу на Information |
| L16 | K | `LedgerReportClient.GetEntriesAsync`: started/finished на Information | начало и конец helper-а на Information |
| L17 | K | `ReminderSender`: `{Email}`, `{Phone}` | PII в логах |
| PT | P | `ReconciliationJob.ExecuteAsync`: `LogError(ex)` без проброса | верх воркера: проброс из `ExecuteAsync` останавливает хост (.NET 8 `StopHost`) |
| PR | P | catch `HttpRequestException` у напоминаний без проброса | по задаче напоминание сверку не останавливает; дефект там только L7 |
| PC | P | итоговое Information «completed» | завершённое бизнес-событие |
| O1 | O | сверка суммы без валюты | проводка в другой валюте с той же суммой считается совпавшей |

Вне ключа допустимо: статический кэш контактов растёт и устаревает.

**RV-R.** Архив (`accounting-archive`).

| Код | Класс | Место | Суть |
|---|---|---|---|
| R1 | K | `AccountingArchiveBuilder.BuildAsync`: `FileStream`, `ZipArchive` без Dispose | zip без central directory, файл держится открытым: архив битый |
| R2 | K | там же: `RecyclableMemoryStream csv` без Dispose | блоки не возвращаются в пул до финализатора |
| R3 | K | `/accounting/corrections`: `using StreamReader` над потоком формы, затем `stream.Position = 0` | поток закрыт - `ObjectDisposedException` на каждой загрузке |
| R4 | K | `AccountingNotifier`: подписка на статическое `ArchiveEvents.Built` без отписки | каждый scope остаётся жить, обработчики множатся |
| R7 | K | `/accounting/archives/{period}`: `new byte[1 МБ]` на запрос | LOH на каждое скачивание |
| R8 | K | `AccountingStorageClient.ChecksumAsync`: `Return` не в `finally` | при исключении или отмене буфер не возвращён |
| R9 | K | статический `Formatters` с лямбдой над `options` | первый scoped-экземпляр билдера удержан навсегда |
| R10 | K | `TempArchiveFile`: финализатор без `IDisposable` | удаление временного файла недетерминировано, исключение в финализаторе роняет процесс |
| PW | P | `StreamWriter(csv, ..., leaveOpen: true)` | верно: поток нужен после писателя |
| PP | P | `ArrayPool` в корректировках с `finally` | верно |
| PH | P | typed `AccountingStorageClient` | верно, `new HttpClient` нет |
| O1 | O | фильтр `CreatedAt.Month == month` без года | в архив ноября попадают ноябри всех лет |

Вне ключа допустимо: `AccountingStorageClient` без `AddStandardResilienceHandler` (ADR-0007); пропуск месяца,
если сервис перезапущен 1-го числа; `DisableAntiforgery` на загрузке корректировок без
аутентификации.

**RV-A.** FX (`fx-rates-refresh`).

| Код | Класс | Место | Суть |
|---|---|---|---|
| A2 | K | `CurrencyCatalog.OnChanged`: `async void` | исключение при перечитывании (файл в момент записи) роняет процесс |
| A3 | K | конструктор `CurrencyCatalog`: `_ = ReloadAsync(None)` | сбой первой загрузки потерян, каталог пуст - все котировки 400 |
| A4 | K | `ReloadAsync`: `Task.Run(() => File.ReadAllLines)` | фальшивый async, есть `ReadAllLinesAsync` |
| A9 | K | `ReloadAsync`: `Monitor.Enter` вокруг `await` | `Exit` на другом потоке - `SynchronizationLockException` |
| A11 | K | `QuoteInvoicesHandler`: `WhenAll` на до 10 тыс. счетов | до 10 тыс. одновременных запросов в справочник |
| A10 | K | `RevaluationHandler`: `OneAtATime.Release()` не в `finally` | исключение или отмена - семафор занят навсегда, следующие отчёты висят |
| A7 | K | `RevaluationHandler`: цикл пеней по 200 тыс. счетов без проверки токена | клиент ушёл - расчёт идёт и держит семафор |
| A8 | K | `RevaluationHandler.RateAsync`: linked CTS без `CancelAfter` | зависание справочника не ограничено 5 с |
| P5 | P | `QuoteInvoicesHandler.GetRateAsync`: `return await` | проброс через async/await допустим (AsyncGuidance) |
| PW | P | `Task.WhenAll(issuedTask, rubTask)` | два независимых вызова |
| PC | P | нет `ConfigureAwait(false)` | ASP.NET Core без контекста синхронизации |
| O1 | O | `CachedFxRates`: статический кэш на 10 минут | против ADR-0005: курс на момент операции |

Вне ключа допустимо: `FileSystemWatcher` не освобождается; `_codes` без `volatile`.

**RV-V.** Импорт (`partner-import`).

| Код | Класс | Место | Суть |
|---|---|---|---|
| V6 | K | `FxRate`: `GreaterThan(0)`, тело читает Newtonsoft | `Infinity` проходит, `(decimal)` - `OverflowException`, 500 |
| V7 | K | валидатор парсит `ru-RU`, хендлер - `decimal.Parse(dto.Amount)` | `"1234,50"` читается как 123450: сумма x100 |
| V2 | K | `MaximumLength(256)`, `MaximumLength(255)` литералами; тест на 300 | пределы расходятся с задачей (64, 256), граница не проверена |
| V13 | K | `new PartnerInvoiceNumber(...)` бросает на шаблоне | валидатор проверяет только длину: 500 вместо 400 |
| V17 | K | размер тела правилом валидатора | тело уже прочитано; Kestrel по умолчанию принимает 30 МБ |
| V18 | K | `Comment`: байты `JsonSerializer.Serialize` с энкодером по умолчанию | кириллица `\uXXXX` - предел ЭДО строже втрое |
| V19 | K | `amount.range`: аргументы `[Max, Min]` при шаблоне «от {0} до {1}» | партнёр видит «от 1000000 до 1» |
| V3 | K | `RuleFor(x => x.CustomerId)` без правила | `Guid.Empty` проходит |
| V4 | K | `RuleFor(x => x.Kind)` без `IsInEnum` | Newtonsoft принимает 99 |
| V14-P | P | `validator.Validate` в хендлере | конвенция проекта (`BillingValidator.Check`) |
| PL | P | `PartnerLimits` | константы - верно |
| O1 | O | повтор запроса партнёром | дубли счетов: нет идемпотентности по партнёру и `externalNumber`, `partnerId` не используется |

Вне ключа допустимо: `x 100` вместо экспоненты валюты (ADR-0004); предел суммы не проверяется после
умножения на `fxRate`; `customerId` не сверяется с партнёром, сам партнёр не аутентифицирован.

**RV-Q.** Сборка (`build-hardening`).

| Код | Класс | Место | Суть |
|---|---|---|---|
| Q2 | K | `.editorconfig` `category-Security/Reliability` + `AnalysisMode` в props | bulk игнорируется: правила безопасности не ошибки |
| Q5 | K | `NoWarn CA1031;CA1062;CA1848;CA2007;CA1515` | глобально без причины, CA1031 прячет catch-all |
| Q9 | K | `NoWarn NU1902;NU1903` | уязвимости заглушены вопреки задаче |
| Q8 | K | `NuGetAuditMode` не задан, net8 | транзитивные не аудируются |
| Q6 | K | `LedgerOutboxDispatcher`: `#pragma warning disable CA2000` до конца файла | без `restore` и причины |
| Q7 | K | `InMemoryInvoiceRepository`: `#pragma warning disable CA1812` на файл | нужен `SuppressMessage` с `Justification`, как у `InMemoryOutbox` |
| Q12 | K | NsDepCop без `config.nsdepcop` | NSDEPCOP03 - Info, слои не контролируются |
| Q10 | K | `dotnet list package --vulnerable` в CI | без `--include-transitive`, код выхода 0 при находке |
| Q15 | K | `--collect:"XPlat Code Coverage"` | порога 70% нет |
| Q3 | Н | `IDE0005 = warning` без `EnforceCodeStyleInBuild` | в сборке не видно; шаг `dotnet format` частично покрывает |
| PS | P | `InMemoryOutbox`: `SuppressMessage` с `Justification` | верно |
| PA | P | `EnableNETAnalyzers`, `AnalysisMode`, TWAE в `Directory.Build.props` | верно |
| PN | P | `NSDEPCOP01 = error` | верно; Q13 - n/a |
| O1 | O | `continue-on-error: true` на шаге тестов | упавшие тесты не роняют CI |

**RV0.** Дайджест (`overdue-digest`). K нет.

| Код | Класс | Место | Суть |
|---|---|---|---|
| PV | P | `validator.Check` в хендлере, `MaxLimit` константой | конвенция проекта |
| PW | P | `OverdueDigestJob`: `LogWarning(ex)` и пропуск дня при `HttpRequestException` | так требует задача |
| PJ | P | `Task.WhenAll(overdueTask, recipientsTask)` | два независимых вызова |
| PD | P | `DateOnly asOf` | дата без времени - верно |
| PT | P | `Task.FromResult` без `async` | синхронная работа, async не нужен |
| PI | P | Information «digest sent» | бизнес-событие |
| O1 | O | фильтр `PaidAt is null` | в дайджест попадают отменённые и черновики |
