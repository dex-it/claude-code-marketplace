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
branches/                 ветки кейсов R1, R0, R2, R3, R4, E1, E0, S1, S2, S3, S4
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
