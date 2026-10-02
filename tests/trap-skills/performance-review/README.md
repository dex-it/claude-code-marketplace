# Протокол испытаний: dex-skill-performance-review

Предмет - скилл `dex-skill-performance-review:performance-review` 1.0.1, копия поданного исполнителю
текста - [`inputs/SKILL-1.0.1.md`](inputs/SKILL-1.0.1.md). Метод - [«Сжатие по свидетельству»](../../README.md#метод-сжатие-по-свидетельству).
Итог - 1.1.0 ([`inputs/SKILL-1.1.0.md`](inputs/SKILL-1.1.0.md)): чек-лист названий тем без
ловушек; строка в реестре [`tests/README.md`](../../README.md).

Дата прогонов: 2026-09-26. Исполнитель - opus (тир потребителей: `mr-reviewer`, `mr-check-reviewer`,
`self-reviewer`), субагент без `Skill` tool. Вердикт - чтением REVIEW.md по ключу; ключ исполнителю
не показывался.

Коды прогонов: `c` - контроль без скилла, `s` - со скиллом 1.0.1, `l` - только чек-лист 1.0.1
названиями ([`inputs/CHECKLIST-only.md`](inputs/CHECKLIST-only.md)), `n` - чек-лист и ловушка
копии буфера (`n1` - формулировки чек-листа из `CHECKLIST-only.md`, `n2` - после правки названий,
[`inputs/SKILL-n2.md`](inputs/SKILL-n2.md)), `m` - чек-лист `n2` без ловушки, редакция 1.1.0.

## Состав

```
inputs/review-a/   Orders.Api: отчёты и счета (.NET 8, EF Core 8 + Npgsql, lazy proxies)
inputs/review-b/   Catalog.Worker: импорт CSV, синхронизация цен (.NET 8 worker)
inputs/review-c/   Loyalty.Sync: импорт транзакций (Python 3.12, psycopg2 2.9, httpx)
inputs/review-d/   Shop.Api: модуль возвратов - большой MR с шумом (.NET 8, EF Core Proxies 8, Npgsql 8)
inputs/*.md        тексты, поданные в прогонах s, l, n, m
runs/<прогон>/     REVIEW.md исполнителя
```

## Промпт

`<каталог>` - копия `inputs/review-<кейс>/` вне репозитория; `<стек>`, `<контекст>` и `<описание>` -
по кейсу ниже.

```
Ты <.NET|Python>-ревьюер в команде. Репозиторий <имя> (<стек>) лежит в каталоге <каталог> .
<контекст>

[s, l, n, m:] Перед работой прочитай <путь>/SKILL.md - ловушки ревью, принятые в команде.
[l: «темы ревью, принятые в команде»]

Сделай ревью MR. В MR весь каталог - это новый код. Описание MR: «<описание>»

Запиши находки в REVIEW.md в этом же каталоге: на каждую - файл:строка, что не так, чем это кончится,
severity (blocker/major/minor). Код не правь.

Ограничения: не вызывай Skill tool; не читай и не пиши файлы вне этого каталога [кроме названного
SKILL.md]; не запускай сборку и dotnet [C: python и тесты]. В ответе - число находок по severity.
```

| Кейс | Контекст | Описание MR |
|---|---|---|
| A | 40 тыс. клиентов, 3 млн заказов | Отчёты по клиентам и счета: сводка по клиенту, список рассылки, выгрузка заказов для бухгалтерии, PDF-счёт с контрольной суммой, пересчёт суммы заказа в валюту. |
| B | около 200 тыс. товаров | Воркер каталога: ночной импорт выгрузки поставщика (CSV), синхронизация цен с API поставщика каждые 10 минут, применение изменений цен через событие. |
| C | 40 тыс. участников, около 500 тыс. строк выгрузки в сутки, около 2000 активных правил | Импорт транзакций партнёров с начислением баллов, отчёт по импорту, синхронизация справочника партнёров и валют. |
| D | 2 млн заказов, около 15 тыс. возвратов в месяц, около 400 RPS, список возвратов открывают постоянно | Модуль возвратов: заявка на возврат с валидацией, список заявок для поддержки, одобрение с возвратом денег через платёжный шлюз, отклонение, уведомления клиенту, ночная сверка возвратов со шлюзом, определение тенанта по хосту. |

## Ключ

`K` - дефект под ловушку скилла 1.0.1, `P` - приманка (находка по ней ложная), `O` - дефект вне скилла.

### A - Orders.Api

| id | Место | Дефект | Ловушка |
|---|---|---|---|
| K1 | CustomerReports.Summary | lazy `order.Lines` в цикле по заказам | N+1 |
| K2 | OrderExport.Export | выгрузка всех заказов статуса без предела и потока | выборка без предела |
| K3 | CustomerReports.MailingList | вся Customer (Photo, Notes) ради Email | лишние колонки |
| K4 | CustomerReports.HasOrders | `CountAsync > 0` | Count vs Any |
| K5 | CustomerReports.Summary | `db.Orders.ToListAsync()` всех 3 млн + Count в памяти | фильтр в памяти |
| K10 | Invoice.Invoice | `rates.GetRateAsync(..).Result` | sync-over-async |
| K11 | CurrencyConverter.Convert | HTTP (`GetResult`) под lock ради счётчика | лок вокруг IO |
| K12 | Invoice.Invoice | `Task.Run` вокруг CPU-чексуммы в хендлере | CPU в обработчике |
| K14 | Invoice.Invoice | `IQueryable` как `IEnumerable` обходится дважды: Sum и Render | повторный обход ленивого |
| K21 | Invoice.Invoice | копия pdf без заголовка ради чтения | копия vs срез |
| K23 | Checksum.Compute | P/Invoke crc32 на каждый байт | натив-вызов на элемент |
| K24 | Invoice.Invoice | `EnumerateFiles(..).ToList().Count > 0` | Count vs Any после ToList |
| K25 | CustomerReports.Summary | `LogDebug($"..{Serialize(orders)}")` считается всегда | аргумент лога |
| P1 | RateService | typed HttpClient через AddHttpClient | приманка |
| P3 | OrderExport | StringBuilder в цикле | приманка |
| O1 | OrderExport.Export | `FromSqlRaw` с интерполяцией status - SQL-инъекция | вне скилла |
| O2 | CustomerReports.Summary | `(int)linesTotal` - усечение суммы | вне скилла |

### B - Catalog.Worker

| id | Место | Дефект | Ловушка |
|---|---|---|---|
| K6 | CatalogImportJob | SaveChangesAsync на каждую строку | запись в цикле |
| K7 | PriceSyncWorker.FetchPriceAsync | `new HttpClient` на каждый SKU | клиент на вызов |
| K8 | CatalogImportJob | `File.ReadAllText` + Split всей выгрузки | весь файл в память |
| K9 | PriceSyncWorker.SyncOnceAsync | await FetchPrice по одному на 200 тыс. SKU | await последовательно |
| K13 | CatalogImportJob | `existingSkus` List.Contains в цикле | линейный поиск в цикле |
| K15 | CatalogImportJob | `new JsonSerializerOptions` на строку | объект в цикле |
| K16 | CatalogImportJob | `new CultureInfo("ru-RU")` на строку | объект в цикле |
| K17 | CatalogImportJob | `skipped += sku + ","` | конкатенация в цикле |
| K18 | CatalogImportJob | `new Regex(skuFormat)` на строку | объект в цикле |
| K19 | CatalogImportJob | `^([\p{L}\p{N}]+[ ,.-]?)*$` на описании из файла | бэктрекинг regex |
| K20 | PriceSyncWorker/PriceChangeHandler | подписка на singleton-событие каждый цикл без отписки | удержание подпиской |
| K22 | PriceSyncWorker.PriceCache | static Dictionary, ключ sku+минута, без границы | кэш без границы |
| P4 | PriceSyncWorker | lock вокруг инкремента счётчика | приманка |
| P5 | CatalogImportJob | static readonly Regex DescriptionPattern - размещение верное | приманка |
| P6 | CatalogImportJob | `Currencies.Contains` - массив из 3 | приманка |
| O3 | CatalogImportJob | дубль SKU в файле -> PK violation посреди импорта | вне скилла |
| O4 | PriceSyncWorker | исключение в SyncOnceAsync роняет BackgroundService и хост | вне скилла |

### C - Loyalty.Sync

| id | Место | Дефект | Ловушка |
|---|---|---|---|
| KC1 | import_transactions.import_file | `cur.executemany` на ~500 тыс. строк: в psycopg2 - запрос на строку | пакет (оговорка psycopg2) |
| KC2 | import_transactions.match_rule | `re.search(rule.pattern, ...)` по ~2000 шаблонам: кэш `re` вымывается | regex в цикле (оговорка кэша `re`) |
| KC3 | report.ReportBuilder | `self.body +=` на каждую строку: оптимизация CPython на атрибут не действует | конкатенация (оговорка CPython) |
| KC4 | import_transactions.import_file | UPDATE members на каждое начисление | запрос в цикле |
| KC5 | partners_sync.sync_partners | gather без лимита; синхронный psycopg2 внутри `async def` | await, блокировка loop |
| PC1 | reference.load_currencies | `execute_values` | приманка |
| PC2 | reference.CURRENCY_CODE | `re.compile` на уровне модуля | приманка |
| PC3 | import_transactions | `csv.DictReader` по открытому файлу - потоково | приманка |
| OC1 | import_transactions | float для суммы | вне скилла |
| OC2 | import_transactions | `except Exception: continue` после сбоя UPDATE: транзакция в aborted, commit откатывает всё | вне скилла |

### D - Shop.Api

| id | Место | Дефект | Ловушка |
|---|---|---|---|
| KD1 | ReturnMapper.ToListItem | lazy `r.Lines`, `r.Order`, `r.Order.Lines`, `r.Order.Customer` на каждый элемент страницы | N+1 |
| KD2 | TenantFilter.OnActionExecuting | `.Result` на каждом запросе | sync-over-async |
| KD3 | RefundGateway | `new HttpClient` на каждый вызов | клиент на вызов |
| KD4 | ReturnsReconciliationJob | `gatewayIds` List.Contains в цикле | линейный поиск в цикле |
| KD5 | ReturnValidator | `CountAsync > 0` | Count vs Any |
| PD1 | ReturnNotifier | typed HttpClient | приманка |
| PD2 | OrderLookup | AsNoTracking + проекция | приманка |
| PD3 | ReturnsController.List | Skip/Take с потолком | приманка |
| OD1 | ReturnValidator | количество возврата не сверяется с заказанным (`orderLine.Quantity < 0`) | вне скилла |
| OD2 | ReturnPolicy | `DateTime.Now` против UTC `CreatedAt` | вне скилла |
| OD3 | ReturnService.ApproveAsync | возврат денег до SaveChanges, без идемпотентности | вне скилла |

## Вердикты

| Кейс | Прогоны | Дефекты под ловушки | Приманки | Вне скилла |
|---|---|---|---|---|
| A | c1, c2 | все, кроме K21 (0/2) | 0 ложных | O1 O2 2/2 |
| A | s1, s2 | все, K21 2/2 | 0 ложных | O1 O2 2/2 |
| B | c1, c2 | все 2/2 | P4 отмечен как лишний лок, minor - замечание верное, не ложное | O3 O4 2/2 |
| B | s1, s2 | все 2/2 | то же | O3 O4 2/2 |
| C | c1, c2 | KC1-KC5 2/2, включая оговорки psycopg2, кэша `re` и CPython | 0 ложных | OC1 OC2 2/2 |
| C | s1, s2 | KC1-KC5 2/2 | 0 ложных | OC1 OC2 2/2 |
| D | c1, c2 | KD1-KD4 2/2, **KD5 0/2** (c2 назвал `CountAsync` только как гонку) | 0 ложных | OD1-OD3 2/2 |
| D | l1, l2 | KD1-KD5 2/2 | 0 ложных | OD1-OD3 2/2 |
| D | s1, s2 | KD1-KD5 2/2 | 0 ложных | OD1-OD3 2/2 |
| D | n1 | KD1-KD5 | 0 ложных | OD1-OD3 |
| A | n1 | все, K21 и K24 пойманы | 0 ложных | O1 O2 |
| D | n2 | KD1-KD5 | 0 ложных | OD1-OD3 |
| A | n2 | все, K21 и K24 пойманы | 0 ложных | O1 O2 |
| A | m1, m2 | все, K21 и K24 2/2 | 0 ложных | O1 O2 2/2 |

Итог:

- Контроль без скилла на opus ловит оба раза все дефекты под ловушки, кроме двух: K21 (копия буфера
  вместо среза, A) и KD5 (`CountAsync > 0` на большом MR с шумом, D). Библиотечные оговорки
  ловушек 1.0.1 (psycopg2 `executemany`, кэш `re`, in-place конкатенация CPython) контроль знает сам.
- Чек-лист названиями без ловушек закрывает KD5 так же, как полный скилл, - на шумном MR он
  возвращает внимание к теме, которую контроль пропускает среди находок крупнее.
- K21 закрыт прогонами `s` (2/2), `n1`, `n2` и чек-листом без ловушки `m` (2/2): контроль тему не
  поднимает, пункт «Копия крупного массива или буфера вместо среза» поднимает, и ловушка сверх него
  ничего не добавляет.
- Скилл охват ревью не сужал: дефекты вне скилла найдены во всех режимах.

Решение для 1.1.0: чек-лист названиями тем; четыре принципа и все ловушки сняты, последней -
«Копия буфера ради чтения его части» по прогонам `m`. Формулировки пунктов чек-листа сверены слепым чтением
(opus, без контекста): двояко читавшиеся пункты переименованы, пересекавшиеся «наличие через счёт» и
«материализация ради наличия» сведены в `Count() > 0` против `Any()`, во вступление добавлено
условие находки (горячий путь или растущий объём).
