# Ревью MR: Catalog.Worker (~200 тыс. товаров)

Проверено по SKILL.md (производительность: запись/внешний вызов в цикле, Count vs Any, копии буферов) плюс общий обзор корректности.

## Blocker

1. **Pricing/PriceSyncWorker.cs:35-42,56-57** - HTTP-запрос к API поставщика на каждый товар в цикле, последовательно, вместо пакетного запроса. Кроме того, на каждый вызов создаётся `new HttpClient`. Итог: 200 тыс. запросов за цикл при периоде 10 минут. Цикл не укладывается в период, ticks копятся, поставщик может начать отдавать 429 или забанить. Каждый вызов открывает новый сокет, что ведёт к исчерпанию портов (TIME_WAIT). Нужен пакетный эндпоинт или чанки с ограниченным параллелизмом, а `HttpClient` брать через `IHttpClientFactory`.
2. **Pricing/PriceSyncWorker.cs:31-32** - `handler.OnPriceChanged` подписывается на синглтон `CatalogEvents` на каждом тике и не отписывается. Scope и `DbContext` при этом освобождаются. Итог: на 2-м тике событие вызывает и старые обработчики с уже disposed `DbContext`, получаем `ObjectDisposedException`, который роняет `RaisePriceChanged`, цикл и весь воркер. Кроме того, утечка обработчиков, а каждое изменение цены применяется N раз. Нужно отписываться в `finally` или вообще не использовать событие для вызова внутри одного процесса.
3. **Import/CatalogImportJob.cs:11,28** - regex `^([\p{L}\p{N}]+[ ,.-]?)*$` страдает катастрофическим бэктрекингом: вложенный квантификатор, а разделитель необязателен. Строка вроде `"aaaaaaaaaaaaaaaaaaaaaaaa!"` даёт экспоненциальное время. Описание приходит из внешнего файла. Итог: одна строка вешает ночной импорт на минуты и часы, 100% CPU. Нужно переписать регулярку (`^[\p{L}\p{N}]+([ ,.-][\p{L}\p{N}]+)*$` или без регулярки), задать `matchTimeout`.
4. **Import/CatalogImportJob.cs:53** - `SaveChangesAsync` внутри цикла, на каждую строку (запись в цикле вместо пакета). Для 200 тыс. строк это 200 тыс. round-trip'ов и транзакций. Вдобавок `ChangeTracker` растёт (все добавленные сущности остаются отслеживаемыми), и `DetectChanges` деградирует до O(n²). Итог: импорт занимает часы и держит память. Нужно сохранять батчами (500-1000), очищать tracker (`ChangeTracker.Clear()`) или использовать COPY/`EFCore.BulkExtensions`.

## Major

5. **Import/CatalogImportJob.cs:17,33** - `existingSkus` это `List<string>`, а `Contains` выполняется на каждую строку: O(n·m), порядка 4·10^10 сравнений строк при 200 тыс. × 200 тыс. Нужен `HashSet<string>`. Также новые SKU не добавляются в набор: дубль внутри самого файла даёт нарушение PK на `SaveChanges` и падение импорта посреди работы.
6. **Import/CatalogImportJob.cs:24-49** - нет защиты от битых строк: `cols[2]`, `cols[4]`, `cols[5]` дают `IndexOutOfRange` при короткой строке, `JsonSerializer.Deserialize` и `decimal.Parse` бросают при неверном значении. Одна плохая строка роняет весь импорт, при этом строки, уже сохранённые построчно, остаются (частичный импорт без отката). `;` внутри названия или JSON ломает наивный `Split`. Нужен нормальный CSV-парсер, `TryParse` и учёт отбракованных строк.
7. **Import/ImportScheduler.cs:14-16** (и **PriceSyncWorker.cs:22**) - нет try/catch вокруг работы. В .NET 8 необработанное исключение в `BackgroundService` останавливает весь хост (`BackgroundServiceExceptionBehavior.StopHost`). Итог: одна ошибка в импорте или сети уронит и синхронизацию цен, а процесс завершится.
8. **Pricing/PriceSyncWorker.cs:13,37-41** - статический `Dictionary` `PriceCache`: ключ содержит минуту (`yyyyMMddHHmm`), так что попаданий в кэш фактически нет, а записи не удаляются никогда. Утечка: ~200 тыс. записей каждый тик, ~29 млн в сутки, до OOM. Кроме того, `Dictionary` небезопасен для многопоточного доступа и `static` без причины. Кэш не нужен или нужен с TTL (`MemoryCache`).
9. **Pricing/PriceChangeHandler.cs:12-14** - синхронный `ExecuteUpdate` (sync-over-async блокировка потока) на каждое изменение: UPDATE в цикле, по одному на товар, вместо пакетного. Для массового изменения цен это тысячи round-trip'ов. Лучше собирать изменения и применять пакетом (`UPDATE ... FROM unnest`).
10. **Data/CatalogDbContext.cs:12** - `Dictionary<string,string>` с `HasColumnType("jsonb")`: в Npgsql 8 без `EnableDynamicJson()` на `NpgsqlDataSourceBuilder` (или value converter/owned JSON) маппинг не работает. Итог: падение при создании модели или первом запросе. Миграций и схемы в MR нет.
11. **Pricing/PriceSyncWorker.cs:57-58** - нет таймаута и обработки статуса: `GetFromJsonAsync` бросает на любой не-2xx, `dto!` падает на `null`. Один 404 по одному SKU роняет весь цикл (см. п. 7). Нужен per-item try/catch, `Timeout`, ретраи.

## Minor

12. **Import/CatalogImportJob.cs:27** - `new Regex(...)` на каждую строку (кэш статического регэкспа не используется): 200 тыс. конструкций и разборов. Вынести в `static readonly` с `[GeneratedRegex]`.
13. **Import/CatalogImportJob.cs:18,30,36,57** - `skipped += sku + ","` это конкатенация строки в цикле, O(n²) по копированию; итоговая строка может быть огромной и уходит одной записью в лог. Использовать счётчик и ограниченный список/файл отчёта.
14. **Import/CatalogImportJob.cs:16,21** - `File.ReadAllText` и `Split('\n')` загружают весь файл и массив строк в память, плюс блокирующее чтение в async-методе. Читать потоком (`StreamReader.ReadLineAsync`).
15. **Import/CatalogImportJob.cs:40,42** - `JsonSerializerOptions` (дорогой, кэш метаданных) и `CultureInfo` создаются на каждую строку. Вынести в `static readonly`; `JsonSerializerOptions` в цикле особенно вредно.
16. **Import/ImportScheduler.cs:9-11** - `DateTime.Now` и локальное время: при переходе на летнее/зимнее время запуск в 02:00 может пропуститься или удвоиться; результат зависит от TZ контейнера. Использовать UTC или явную TZ.
17. **Pricing/PriceChangeHandler.cs:6,8,15** - `_applied` растёт и нигде не читается (утечка в рамках жизни handler'а); `ILogger` не типизирован.
18. **Pricing/PriceSyncWorker.cs:14,47,51** - `_changed` читается без lock, а lock вокруг `++` в однопоточном цикле лишний; счётчик «changed so far» в логе вводит в заблуждение.
19. **Pricing/PriceSyncWorker.cs:34** - вся таблица читается в память (`ToList`) на каждый тик; лучше стримить или читать постранично. Валюта не учитывается при сравнении цен (`price != p.Price`).
20. **Program.cs:8-9** - строка подключения `Catalog` и `Import:Path`, `Supplier:BaseUrl` не валидируются (`!` по `null`): падение на старте/в ночи с `NullReferenceException`. Нужен `ValidateOnStart` через options.

## Итого

- blocker: 4
- major: 7
- minor: 9

Всего: 20
