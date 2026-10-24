# Мини-проект Pricing: вход наборов группы 2.2

Сервис цен на .NET 10: решение из пяти проектов и пакета `Pricing.Contracts`, контроллеры,
Swashbuckle, CPM, типизированный клиент нестабильного Supplier API со стандартным хендлером
устойчивости, unit-тесты на xUnit и Moq. Вход наборов
[dotnet-testing-patterns](../../dotnet-testing-patterns/README.md),
[dotnet-api-development](../../dotnet-api-development/README.md),
[dotnet-csproj-hygiene](../../dotnet-csproj-hygiene/README.md),
[dotnet-resilience](../../dotnet-resilience/README.md) и [dotnet-caching (снят)](../../removed/dotnet-caching/README.md)
(эпик #291, #297). Файл - ключ для судьи, исполнителю не подаётся: `setup.sh` его в каталог прогона
не копирует.

```
setup.sh <dest> [ветка]   разворачивает git-репозиторий: stages/* - коммиты main, branches/<имя>/* - ветка feature/<имя> от main
stages/1-catalog-quotes   каталог, котировка с ценой поставщика, промо по времени, ADR-0001..0002, пакет Pricing.Contracts 1.3.0
branches/                 код - G0, G-A, G-R, G-H, G-T, G-P; ревью - RV-A, RV-S, RV-H, RV-T, RV-C, RV0
run-group-2-2.sh          раннер: промпты, флаги исполнителя, выход в runs/<кейс>-<набор><N>/
```

Нужны SDK 10.0 и сеть до nuget.org. `nuget.config` держит только nuget.org, кэш пакетов -
`.nuget/packages` в каталоге прогона. Версии пакетов: Swashbuckle.AspNetCore 10.3.0,
Microsoft.Extensions.Http.Resilience 10.10.0, xunit 2.9.3, xunit.runner.visualstudio 4.0.1,
Microsoft.NET.Test.Sdk 18.10.1, Moq 4.21.0; веток - Microsoft.Extensions.Caching.Hybrid 10.10.0,
Microsoft.Extensions.TimeProvider.Testing 10.10.0, CsvHelper, Roslynator.Analyzers 5.0.1.

Нестабильный источник назван в `README.md` проекта: Supplier API в 09:00-11:00 отвечает 503 и
таймаутами до 15 с, лимит 20 запросов в секунду на ключ, своих повторов нет; витрина ждёт ответа не
дольше 3 с.

Все ветки собираются (`dotnet build` без ошибок), тесты зелёные (`b2b-quotes` - 16/16 пять прогонов
подряд, `store-clock` - 13/13), Api стартует и отдаёт `swagger.json` на `store-clock`, `fx-rates`,
`card-cache`, `supplier-portal`; сверка 10.10.2026.

## Кейсы

| Кейс | Ветка | Поручение |
|---|---|---|
| G0 | `feature/volume-discount` | код: скидка за объём в `Pricing.Domain` и unit-тесты (PRC-10); верный исход - доменное правило и тесты без единиц группы |
| G-A | `feature/price-lists` | код: прайс-листы поставщиков - загрузка из ERP, лист по номеру, поиск для портала, пересчёт для планировщика (PRC-11) |
| G-R | `feature/supplier-stock` | код: наличие у поставщика в котировке, резерв строк заказа (PRC-12) |
| G-H | `feature/price-cache` | код: кэш цены поставщика, сброс по вебхуку и служебным вызовом (PRC-13) |
| G-T | `feature/promo-tests` | код: unit-тесты `PromotionService`, `QuoteService`, `PriceChangeWorker` (PRC-14) |
| G-P | `feature/supplier-sdk` | код: клиент Supplier API отдельным пакетом для сервиса на .NET 8 (PRC-15) |
| RV-A | `feature/supplier-portal` | ревью MR: заказы поставщику для портала (PRC-21) |
| RV-S | `feature/fx-rates` | ревью MR: курс валюты поставщика в котировке, ночная синхронизация прайса (PRC-22) |
| RV-H | `feature/card-cache` | ревью MR: кэш карточек, категорий и цены поставщика (PRC-23) |
| RV-T | `feature/b2b-quotes` | ревью MR: массовая котировка B2B и тесты правил цены (PRC-24) |
| RV-C | `feature/price-exports` | ревью MR: выгрузка прайса в CSV, утилита, чистка `Pricing.Contracts` (PRC-25) |
| RV0 | `feature/store-clock` | ревью MR: акции по поясу магазина, скидка категории, срок ответа поставщика (PRC-26); верный исход - ни одной blocker/major в предмете скиллов группы |

Промпты кода и ревью - дословно в [`run-group-2-2.sh`](run-group-2-2.sh). Имя ловушки в задаче не
звучит; задача называет ситуацию и ограничение среды.

## Засчитывание

Как в группе 2.1. Ревью: K засчитан, если находка стоит в месте ключа и её исход снимает дефект
или симптом; слово ловушки и severity не требуются. P - провал, если находка по приманке требует
правки с severity blocker или major. O - дефект вне скиллов группы. Код: K засчитан, если решение из
графы «Засчитывается» есть в месте, где задача создаёт ситуацию; ситуация есть, решения нет -
провал. P в коде - провал, если приманка внесена правкой. Н - наблюдаемая строка, в вердикт единицы
не идёт. `n/a` - клетка в кейсе не возникла (исполнитель не создал ситуацию, которую задача не
требовала).

Коды - по скиллу и номеру ловушки в порядке файла: T - `dotnet-testing-patterns` (T1-T7),
D - `dotnet-api-development` (D1-D19 и D20 - пункт о ключе keyed-сервиса), C - `dotnet-csproj-hygiene`
(C1-C14), S - `dotnet-resilience` (S1-S12), H - `dotnet-caching` (H1-H5).

| Код | Ловушка | Код | Ловушка |
|---|---|---|---|
| T1 | проверка реализации (`Verify`) | D11 | идентификаторы в query |
| T2 | `Assert.True(a == b)` | D12 | фильтры и пагинация в path |
| T3 | цепочка моков | D13 | URL без иерархии, глагол |
| T4 | внешнее состояние | D14 | несогласованность с сервисом |
| T5 | `DateTime.Now` в коде | D15 | все записи без лимита |
| T6 | `Task.Delay` в тесте | D16 | `GenerateDocumentationFile` |
| T7 | `Theory` с bool | D17 | internal в Swagger |
| D1 | толстый контроллер | D18 | enum без описания в схеме |
| D2 | try/catch в action | D19 | фильтр без эффекта |
| D3 | `IActionResult` | D20 | ключ keyed литералом |
| D4 | entity в ответе | C1 | явная поверх транзитивной |
| D5 | лишние поля DTO ответа | C2 | `Version` при CPM |
| D6 | merge под `[JsonExtensionData]` | C3 | `PrivateAssets` у анализатора |
| D7 | непрочитанное поле запроса | C4 | pre-release / range |
| D8 | `async void` | C5 | breaking под minor |
| D9 | путь на каждом методе | C6 | лишняя `ProjectReference` |
| D10 | POST 200 вместо 201 | C7 | цикл `ProjectReference` |
| S1 | лист вместо корня | C8 | вложенный `Directory.Build.props` |
| S2 | матрёшка повторов | C9 | свойство копией в csproj |
| S3 | повтор неидемпотентного | C10 | TFM вразнобой |
| S4 | повтор на 4xx | C11 | CPM частично |
| S5 | без jitter / backoff | C12 | `OutputPath` вручную |
| S6 | per-attempt без total | C13 | `CopyLocalLockFileAssemblies` |
| S7 | timeout больше, чем у вызывающего | C14 | NU1603 |
| S8 | фиксированный timeout батча | H1 | single-flight от `IMemoryCache` |
| S9 | нет circuit breaker | H2 | ручной сброс уже авто |
| S10 | `catch (Exception)` | H3 | запись без тега |
| S11 | нет метрик | H4 | негатив-кэш спекулятивно |
| S12 | тихий fallback | H5 | невалидный negative-TTL |

## Факты, на которые опирается ключ

Сверено зондами 10.10.2026 на SDK 10.0.112 (рантайм 10.0.12); кроме названных, факты взяты из
текста скиллов и в ключе не используются.

| Факт | Свидетельство |
|---|---|
| Стандартный хендлер 10.10.0: total 30 с, попытка 10 с, 3 повтора, экспонента с jitter, breaker `MinimumThroughput` 100, `FailureRatio` 0.1 | `HttpStandardResilienceOptions` по умолчанию, зонд |
| Стандартный хендлер повторяет POST на 503 (4 вызова), не повторяет GET на 400 (1 вызов), повторяет GET на 429 (4 вызова) | зонд с заглушкой |
| `HttpRetryStrategyOptionsExtensions.DisableForUnsafeHttpMethods` есть в 10.10.0 | зонд, компиляция |
| Swashbuckle 10.3.0 с `IncludeXmlComments`: `<summary>` типа enum попадает в `description` схемы, `<summary>` членов - нет | `swagger.json`: `{"enum":[0,1],"type":"integer","description":"Состояние заказа."}` |
| `IncludeXmlComments` с несуществующим файлом (забыт `GenerateDocumentationFile`): `swagger.json` - 500, `FileNotFoundException` | зонд; не «молча игнорирует» |
| `async void` action: ответ 200 до завершения; исключение после `await` роняет процесс (`Unhandled exception`, следующий запрос - соединение отвергнуто) | зонд |
| `ProblemDetails.Extensions["status"]` при заданном `Status` - JSON с двумя ключами `status` | `{"title":"t","status":409,"status":500,"Type":"x"}` |
| Анализатор без `PrivateAssets` в упакованной библиотеке - зависимость в nuspec с `exclude="Build,Analyzers"`, даже при `developmentDependency=true` (Roslynator.Analyzers 5.0.1, PublicApiAnalyzers 5.6.0, SonarAnalyzer.CSharp 10.35) | `dotnet pack`, nuspec |
| `PackageVersion` на несуществующую версию (CsvHelper 33.0.3) - `warning NU1603`, взята 33.1.0; сборка зелёная | сборка `price-exports` |
| `IMemoryCache.GetOrCreate(Async)` не коалесцирует промахи: фабрику запускает каждый поток, нашедший ключ пустым; один вызов на ключ - у `HybridCache` | learn.microsoft.com, «Cache in-memory in ASP.NET Core» (ms.date 2026-05-01): «several threads repopulating the cached item»; «Caching in .NET», HybridCache: «Only one request fetches the data» |
| `FakeTimeProvider(start)` хранит `start` как UTC-момент: стартовое время с offset `+03:00` даёт `GetLocalNow()` со сдвигом ещё на 3 ч | зонд; в `store-clock` старт передан `ToUniversalTime()` |

## Ключ

### G0. Скидка за объём (`volume-discount`)

| Код | Класс | Засчитывается | Провал |
|---|---|---|---|
| G0-P | P | - | новый пакет или `ProjectReference`; правка csproj; HTTP-эндпоинт, кэш, политика устойчивости; `async` в доменном правиле |
| T2, T7 | Н | `Assert.Equal`; `Theory` с данными (количество -> скидка) | - |

### G-A. Прайс-листы (`price-lists`)

| Код | Класс | Засчитывается | Провал |
|---|---|---|---|
| D1 | K | логика загрузки, поиска и пересчёта - в сервисе `Pricing.Application`, контроллер вызывает его | проверки, создание листа, фильтрация в action |
| D2 | K | ошибки - исключением домена через `DomainExceptionHandler` либо `Problem`/`NotFound` без перехвата `Exception` | `try/catch` в action; текст исключения клиенту |
| D3 | K | `ActionResult<T>` и `ProducesResponseType` на ошибках | `IActionResult` |
| D4 | K | ответы - DTO | доменная сущность в ответе |
| D5 | K | `purchaseCost` и `marginPercent` нет ни в одном ответе; в элементе поиска - номер, валюта, статус, период, число позиций, без позиций | секретные поля в ответе; позиции в элементе поиска |
| D7 | K | `erpDocumentId`, `erpUser`, `erpExportedAt` не входят в модель запроса либо хранятся и читаются | поля в модели запроса, их никто не читает |
| D8 | K | `async Task<...>` на всех action | `async void` |
| D9 | K | `[Route]` на контроллере | путь целиком на каждом методе |
| D10 | K | загрузка - 201 с `Location` (`CreatedAtAction`/`CreatedAtRoute`/`Created`) | 200 или 201 без адреса |
| D11 | K | лист по номеру - `supplierId` и `number` в path | идентификаторы в query |
| D12 | K | статус, валюта, дата, страница - в query | фильтры или страница в path |
| D13 | K | URL загрузки, листа, поиска - иерархия существительными | глагол в URL этих трёх |
| D14 | K | схема URL как у `api/products`: `api/`, множественное число, kebab-case, без версии | своя схема (версия, единственное число, другой регистр) |
| D15 | K | поиск постраничный, размер страницы ограничен сверху | весь набор; `pageSize` без верхней границы |
| D16 | K | если включены XML-комментарии - `GenerateDocumentationFile` в csproj Api (или общем props) | `IncludeXmlComments` без генерации файла |
| D17 | K | пересчёт скрыт из Swagger (`ApiExplorerSettings(IgnoreApi = true)`) или не выставлен по HTTP (фоновая работа, вызов в процессе) | пересчёт в публичной схеме |
| D18 | K | разница статусов видна в схеме: описание на типе enum перечисляет значения, либо schema filter, либо `[Description]` с фильтром | описания только `<summary>` на членах; нет описаний |
| D19 | K | каждый фильтр поиска применяется | фильтр принят, но в предикате его нет |
| D6, D20 | n/a | нет merge расширений и keyed-сервисов | - |
| O-A | O | номер листа уникален у поставщика (повтор - 409); `validTo` не раньше `validFrom` | - |

Глагол в URL пересчёта судится только D17; если пересчёт выставлен, его имя в D13 не идёт.

### G-R. Наличие и резерв (`supplier-stock`)

| Код | Класс | Засчитывается | Провал |
|---|---|---|---|
| S1 | K | вызовы наличия и резерва идут через типизированный клиент Supplier API с хендлером устойчивости в `InfrastructureModule` | своя политика вокруг вызова в `QuoteService` или сервисе резерва |
| S2 | K | один слой повторов на вызов | ручной цикл или Polly поверх стандартного хендлера |
| S3 | K | POST резерва повторяется только с `Idempotency-Key`, постоянным на попытки (из `orderId`+SKU или созданным один раз на вызов), либо повторы POST отключены (`DisableForUnsafeHttpMethods`, отдельный клиент без retry) | стандартный хендлер повторяет POST без ключа; ключ новый на каждую попытку |
| S7 | K | наличие в котировке ограничено сроком витрины: total timeout вызова наличия <= 3 с минус работа котировки, по истечении - `available = null` | дефолтный total 30 с на пути котировки |
| S12 | K | отказ наличия -> `available = null` и запись в лог или метрику | `catch` -> `null` без следа |
| S10 | K | fallback ловит сбои вызова (`HttpRequestException`, таймаут, открытый breaker) и не глотает отмену вызывающего | `catch (Exception)` без фильтра, глотающий `OperationCanceledException` вызывающего |
| S4, S5, S9 | Н | стандартный хендлер их закрывает; своя политика судится по графе S4/S5/S9 ключа RV-S | - |
| O-R | O | `supplierId` строки берётся из товара; резерв неизвестного SKU - 404/409, не 500 | - |

### G-H. Кэш цены поставщика (`price-cache`)

| Код | Класс | Засчитывается | Провал |
|---|---|---|---|
| H1 | K | один запрос к поставщику на SKU при конкурентных промахах: `HybridCache` или блокировка на ключ | `IMemoryCache.GetOrCreate(Async)` без коалесцирования |
| H2 | K | служебный сброс по `supplierId` сбрасывает то же, что вебхук с `"skus": null` | служебный сброс снимает меньше |
| H3 | K | записи несут тег поставщика, если сброс идёт по тегу | `RemoveByTagAsync` по тегу, который при записи не ставится |
| H4 | K | отдельного negative-TTL нет | введён свой TTL для «поставщик не знает SKU» без требования |
| H5 | n/a | судится, только если H4 провален: negative-TTL проверяется против основного явно | тихий `if (neg < ttl)` |
| C2 | K | `PackageVersion` нового пакета - в `Directory.Packages.props`, `PackageReference` без `Version` | `Version` в csproj |
| C1 | Н | новый пакет - в проекте, чей код использует его типы | - |
| O-H | O | ключ кэша включает `supplierId`; ошибка поставщика (429, 503) не кэшируется | - |

### G-T. Тесты расчёта цены (`promo-tests`)

| Код | Класс | Засчитывается | Провал |
|---|---|---|---|
| T1 | K | тесты `QuoteService` проверяют цену и итог | только `Verify` вызовов поставщика |
| T2 | K | `Assert.Equal`/`Assert.Null` и т.п. | `Assert.True(a == b)` |
| T4 | K | каждый тест создаёт свои данные | общий статический набор, который тесты меняют |
| T5 | K | шов времени в `PromotionService` (`TimeProvider`, свой `IClock`), тесты с фиксированным временем | тесты от текущего времени: ожидание по `DateTime.Now`, окно вокруг «сейчас» |
| T6 | K | тест `PriceChangeWorker` ждёт детерминированно: завершение канала, отмена токена, ожидание `RunAsync`, опрос с таймаутом | `Task.Delay`/`Thread.Sleep` как ожидание обработки |
| T7 | K | `Theory` только где меняются данные | `InlineData` с bool, переключающими ветку логики |
| T3 | n/a | цепочки зависимостей нет | - |
| C2 | K | пакет для фейкового времени - через `Directory.Packages.props` | `Version` в csproj |
| P-T | P | - | поведение сервисов изменено сверх шва |
| O-T | O | `QuoteService` сравнивает цену поставщика без учёта `Currency` | - |

### G-P. Пакет клиента поставщика (`supplier-sdk`)

| Код | Класс | Засчитывается | Провал |
|---|---|---|---|
| C2 | K | версия `PublicApiAnalyzers` - в `Directory.Packages.props` | `Version` в csproj |
| C3 | K | `PrivateAssets="all"` у анализатора | без `PrivateAssets` |
| C9 | K | новый csproj не копирует `Nullable`, `ImplicitUsings`, `TargetFramework` из `Directory.Build.props` | копия общих свойств |
| C10 | K | пакет доступен .NET 8: `TargetFrameworks` net8.0;net10.0 или `TargetFramework` net8.0, с причиной в комментарии, коммите или ответе | только net10.0 (наследован) - сервис закупок пакет не подключит |
| C1 | K | пакеты - только в проекте, чей код использует их типы | ссылка на пакет без использования |
| C6 | K | `ProjectReference` только на используемые проекты | лишняя ссылка |
| C12, C13 | P | - | `OutputPath`, `CopyLocalLockFileAssemblies` |
| C5 | n/a | 1.0.0 | - |
| O-P | O | пакет не зависит от неопубликуемых проектов (`Pricing.Application`): `ProjectReference` упаковывается зависимостью nuspec; сборка и тесты зелёные | - |

### RV-A. Портал поставщиков (`supplier-portal`)

`SupplierOrdersController.cs`, `PortalProblems.cs`, `SupplierOrder.cs`, `Program.cs`.

| Код | Класс | Место | Суть |
|---|---|---|---|
| D1 | K | `Create` | проверка номера, сборка заказа, сумма, запись в store - в action |
| D2 | K | `catch (Exception)` в `Create`, `GetByNumber`, `GetLines` | `ex.ToString()` / `ex.Message` клиенту с 500; копия в трёх action |
| D3 | K | все action | `IActionResult`, нет `ProducesResponseType` |
| D4 | K | `Ok(order)` в `Create`, `GetByNumber`, `List` | сущность в ответе |
| D5 | K | те же ответы | `InternalNote`, `CostTotal`, цены закупки поставщику (задача запрещает) |
| D6 | K | `PortalProblems.From` | метки закупщика из запроса ложатся в `Extensions` без фильтра: ключ `status`/`type` даёт дубль в JSON |
| D7 | K | `CreateSupplierOrderRequest.Priority` | принимается, нигде не читается |
| D8 | K | `Confirm` | `async void`: 200 до уведомления, исключение роняет процесс |
| D9 | K | контроллер без `[Route]` | путь на каждом методе |
| D10 | K | `Create` | 200 вместо 201 с `Location` |
| D11 | K | `GetByNumber` | `supplierId`, `number` обязательны, в query |
| D12 | K | `ListByState` | статус и страница в path |
| D13 | K | `GetLines` | `api/fetch-supplier-order-lines?orderId=` - глагол, плоский URL |
| D14 | K | маршруты контроллера | схема расходится с `api/products/{id}` |
| D15 | K | `List` | весь набор без страницы |
| D17 | K | `PurgeCancelled` | `internal/...` в публичной схеме |
| D18 | K | `SupplierOrderState` | `Accepted`/`Confirmed` без описания |
| D19 | K | `List` | `filter.Status` не применяется |
| D20 | K | `[FromKeyedServices("email")]` и `AddKeyedScoped(..., "e-mail")` | ключ литералом в двух местах, литералы разошлись: контроллер не создаётся |
| D16 | n/a | XML-комментариев нет | - |
| O-A1 | O | `CostTotal` через `double` | потеря точности денег |
| O-A2 | O | портал без аутентификации; `supplierId` из query | поставщик читает чужие заказы |
| O-A3 | O | `Confirm` неизвестного id | молча 200 |
| P-A | P | `log.LogInformation` с плейсхолдерами | верно |

### RV-S. Курс и синхронизация (`fx-rates`)

`CurrencyConverter.cs`, `QuoteService.cs`, `RatesApiClient.cs`, `SupplierPriceBatchClient.cs`,
`PriceSyncJob.cs`, `InfrastructureModule.cs`, `appsettings.json`.

| Код | Класс | Место | Суть |
|---|---|---|---|
| S2 | K | `CurrencyConverter.ToRubAsync` поверх хендлера `rates` | ручные 3 попытки поверх 6 попыток хендлера: до 18 вызовов на курс |
| S4 | K | `ShouldHandle` хендлера `rates` | любой неуспешный ответ, включая 4xx (неизвестная валюта - 404) |
| S5 | K | хендлер `rates` | `Constant`, `UseJitter = false` |
| S6 | K | хендлер `rates`: `AddRetry`, затем `AddTimeout(10 с)` | timeout внутри retry - только на попытку, общего нет: 6 x 10 с + паузы |
| S7 | K | хендлер `rates` на пути котировки | 10 с на попытку при сроке витрины 3 с |
| S8 | K | `PriceSyncJob`: `CancelAfter(3 с)` на пачку, `BatchSize` 1000 | 1000 x 15 мс = 15 с: каждая пачка отменяется; стандартный хендлер батча - 10 с на попытку |
| S9 | K | хендлер `rates` | нет breaker; комментарий «стабилен» снимает его без замера |
| S10 | K | `CurrencyConverter`: `catch (Exception)` | ловит и отмену вызывающего, и ошибку программиста |
| S12 | K | `CurrencyConverter`: последний `catch` -> `return amount` | сумма в валюте возвращается как рубли, без лога |
| S1 | K | `CurrencyConverter` в `Pricing.Application` | устойчивость в листовом сервисе, а не на клиенте источника |
| S11 | Н | хендлер `rates` | телеметрия Polly пишется по умолчанию; находка о метриках судится по тексту |
| O-S1 | O | `CurrencyConverter`: `amount / rubPerUnit` | деление вместо умножения |
| O-S2 | O | `PriceSyncJob`: ловит только `HttpRequestException` | отмена пачки (`TaskCanceledException`) роняет `BackgroundService` |
| O-S3 | O | `PriceSyncJob`: цены не в RUB пропускаются молча | - |
| P-S1 | P | стандартный хендлер на `SupplierPriceBatchClient` повторяет POST | `prices:batch` - чтение, повтор безопасен; «нужен Idempotency-Key» с blocker/major - провал |
| P-S2 | P | стандартный хендлер на `SupplierApiClient` | дефолты верны для источника; «добавить свой retry» - провал |

### RV-H. Кэш каталога (`card-cache`)

`CachedSupplierCatalog.cs`, `SupplierCacheOptions.cs`, `InfrastructureModule.cs`, `CatalogCache.cs`,
`CatalogController.cs`, `appsettings.json`, `Directory.Packages.props`, `Pricing.Api.csproj`.

| Код | Класс | Место | Суть |
|---|---|---|---|
| H1 | K | `CachedSupplierCatalog`, комментарий «один запрос к поставщику на SKU» | `IMemoryCache.GetOrCreateAsync` не коалесцирует: сотни промахов популярного SKU уходят в лимит 20 rps |
| H2 | K | `CatalogCache.FlushAsync` | сбрасывает тег `products`, а авто-сброс - `products` и `category:*`; категории служебный сброс не трогает |
| H3 | K | `CatalogCache.GetCardAsync` | карточка без тегов, сброс идёт по тегам: изменение цены в карточке не видно 5 мин; служебный сброс не снимает ничего |
| H5 | K | `CachedSupplierCatalog`: `if (price is null && o.NotFoundTtl < o.Ttl)`, `NotFoundTtl` "00:30:00" | ошибка единиц тихо отключает короткий TTL: «нет у поставщика» живёт 10 мин |
| H4 | P | короткий TTL «поставщик не знает SKU» | задача требует его явно; «убрать негатив-кэш» - провал |
| C2 | P | `Microsoft.Extensions.Caching.Hybrid` в `Directory.Packages.props`, `PackageReference` без версии | верно |
| O-H1 | O | ключ `supplier-price:{sku}` без `supplierId` | цены поставщиков с одним SKU смешиваются |
| O-H2 | O | фабрика ловит `ct` первого вызывающего | его отмена роняет запрос, который ждёт тот же ключ (низкий риск) |

### RV-T. Массовая котировка и тесты (`b2b-quotes`)

`QuoteBatchService.cs`, `TestCatalog.cs`, `QuoteServiceTests.cs`, `PromotionServiceTests.cs`,
`QuoteBatchServiceTests.cs`.

| Код | Класс | Место | Суть |
|---|---|---|---|
| T1 | K | `Quote_asks_supplier_for_each_line` | только `Verify` вызовов: поведение (цена, итог) не проверено |
| T2 | K | `Quote_uses_base_price_when_supplier_is_cheaper`: `Assert.True(quote.Total == 300m)` | сообщение без значений |
| T3 | K | `QuoteBatchServiceTests`: `IPricingSources` возвращает моки | мок возвращает мок; агрегатор зависимостей в коде MR |
| T4 | K | `TestCatalog.Products` - статический список; `Quote_uses_supplier_price_when_it_is_higher` меняет цену SKU-42 | общее изменяемое состояние, классы тестов идут параллельно: падение зависит от порядка |
| T5 | K | `PromotionServiceTests`: окно вокруг `DateTime.Now`, `Night_promotion_works_after_midnight` с ожиданием от часа | `PromotionService` читает `DateTime.Now`; тест ночного окна выводит ожидание из того же часа, что и код |
| T6 | K | `QuoteBatchServiceTests`: `await Task.Delay(500)` | ожидание фона по времени |
| T7 | K | `Discount_by_category` | `InlineData` с двумя bool, логика ветвится по ним |
| P-T1 | P | `Customer_is_notified_when_quote_is_ready`: `Verify` уведомления | уведомление - наблюдаемый исход; провал - требовать замены на проверку результата с blocker/major |
| P-T2 | P | `Discount_is_the_largest_active` | `Theory` с данными - верно |
| O-T1 | O | `QuoteBatchService.Start`: `_ = Task.Run(...)` | исключение фоновой котировки теряется, запрос висит без ответа и без уведомления |

### RV-C. Выгрузка прайса (`price-exports`)

`Directory.Packages.props`, `src/Pricing.Exports/Pricing.Exports.csproj`, `src/Pricing.Contracts/*`,
`tools/Directory.Build.props`, `tools/Pricing.ExportCli/Pricing.ExportCli.csproj`.

| Код | Класс | Место | Суть |
|---|---|---|---|
| C1 | K | `Pricing.Exports`: `Microsoft.Extensions.Http.Resilience` | типы пакета не используются |
| C3 | K | `Pricing.Exports` (пакет): `Roslynator.Analyzers` без `PrivateAssets` | анализатор - зависимость nuspec у потребителей пакета |
| C4 | K | `ExportCli`: `CsvHelper` `33.*` | плавающая версия |
| C5 | K | `Pricing.Contracts` 1.3.0 -> 1.4.0, удалён `GrandTotal` | удаление члена под minor |
| C6 | K | `Pricing.Exports` -> `Pricing.Infrastructure` | типы не используются |
| C8 | K | `tools/Directory.Build.props` без импорта корневого | утилита теряет `Nullable`, `ImplicitUsings`, `TargetFramework` корня |
| C9 | K | `Pricing.Exports`: `TargetFramework`, `Nullable`, `ImplicitUsings` | копия корневого props |
| C10 | K | `Pricing.Exports`: `LangVersion` preview | языковая версия вразнобой с решением |
| C11 | K | `ExportCli`: `ManagePackageVersionsCentrally` false и `Version` | проект вне CPM |
| C12 | K | `Pricing.Exports`: `OutputPath` `..\..\artifacts\exports\` | путь вручную |
| C13 | K | `Pricing.Exports`: `CopyLocalLockFileAssemblies` | флаг в библиотеке |
| C14 | unverifiable | `CsvHelperVersion` 33.0.3 | версии нет на фиде: NU1603, взята 33.1.0. Ревьюеру restore недоступен, отсутствие версии из манифеста не выводится: находка записывается Н, в вердикт не идёт |
| C2 | Н | версия в csproj при CPM - только в `ExportCli`, вне CPM | судится C11 |
| C7 | n/a | цикл ссылок MSBuild не собирает | - |
| P-C1 | P | `Pricing.Exports` -> `Pricing.Domain` | `Product`, `Category` используются напрямую - ссылка верна |
| P-C2 | P | `<Version>1.0.0</Version>` пакета в csproj | версия пакета, не `PackageReference` |
| O-C1 | O | `PriceListExporter`: `CultureInfo.CurrentCulture` | десятичный разделитель зависит от машины |
| O-C2 | O | `Pricing.Exports` (пакет) ссылается на проекты решения | nuspec зависит от неопубликованных `Pricing.Application`, `Pricing.Domain`, `Pricing.Infrastructure` |

### RV0. Время магазина (`store-clock`)

K нет. Верный исход - ни одной blocker/major в предмете скиллов группы.

| Код | Класс | Место | Суть |
|---|---|---|---|
| P0-S | P | `AddStandardResilienceHandler`: total 2.5 с, попытка 1 с | укладывается в срок витрины; breaker и jitter по умолчанию |
| P0-S2 | P | `QuoteService`: срок 2.5 с на цены поставщика всей котировки; `SupplierApiClient` ловит таймаут, разомкнутый breaker и `HttpRequestException` без кода, 429 или 5xx -> лог и базовая цена; 4xx пробрасывается | фолбэк с узким фильтром и следом в логе, отмена вызывающего пробрасывается (тест), базовая цена - решение задачи - верно |
| P0-T1 | P | `PromotionServiceTests`: `Theory` по времени магазина | данные, не ветки - верно |
| P0-T2 | P | `FakeTimeProvider` + `SetLocalTimeZone` | шов времени - верно |
| P0-C | P | `Microsoft.Extensions.TimeProvider.Testing` через CPM | верно |
| P0-D | P | `GET api/promotions/active?category=` | фильтр в query, `ActionResult<T>`, DTO - верно |
| Н0 | Н | `StoreTimeProvider` для поясного времени | `GetLocalNow()` по поясу магазина |
