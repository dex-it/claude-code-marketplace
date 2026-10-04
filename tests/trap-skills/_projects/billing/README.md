# Мини-проект Billing: общий вход наборов группы 0

Сервис счетов на .NET 8 с историей коммитов, ADR, сводом правил и закрытым пакетом. Вход наборов
[fact-verification](../../fact-verification/README.md) и
[codebase-conventions](../../codebase-conventions/README.md). Файл - ключ для судьи, исполнителю
не подаётся: `setup.sh` его в каталог прогона не копирует.

```
setup.sh <dest> [ветка]   разворачивает git-репозиторий: stages/* - коммиты main, branches/<имя>/* - ветка feature/<имя>
vendor/                   исходник Acme.Ledger.Client 2.3.1; в прогон попадает только nupkg в packages-local/ (DebugType none, без XML-doc)
stages/                   1 счета+Ledger+FX, ADR-0001..0005; 2 outbox, ADR-0006; 3 ADR-0007 вместо ADR-0003; 4 свод docs/rules (RUL-0001..0004); 5 enum в JSON строками (`ApiModule`)
branches/                 ветки кейсов R1, R0, R2, R3
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
