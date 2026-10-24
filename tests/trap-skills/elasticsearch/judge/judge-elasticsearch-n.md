# Судья: elasticsearch, набор n (колонки n1 | n2)

## g-e (код). Файл-основание: elasticsearch/runs/g-e-n{1,2}/DIFF.patch
Сокращения: CI = Search/CatalogIndexer.cs (n1), PI = Search/ProductIndexer.cs (n2), PS = ProductSearch.cs (n1) / ProductSearchService.cs (n2).

| единица | n1 | n2 | основание |
|---|---|---|---|
| E1 | 1 | 1 | n1 CI:48-68 `Mappings(Properties<ProductDocument>...)` явный; n2 PI:190-216 `TypeMapping` с Properties |
| E2 | 1 | 1 | n1 PS:99 `MultiMatchQuery` по text, категория `TermQuery` по keyword (:111); n2 PS:413 MultiMatch, :334 Term по keyword `category` |
| E3 | 1 | 1 | n1 CI:60 подполе `sort` keyword, PS:124 сортировка `name.sort`; n2 PI:202 `raw` keyword, PS:446 `name.raw` |
| E4 | 1 | 1 | n1 PS:49-84 PIT + `SearchAfter`, sort по sku; n2 PS:363-399 PIT + `SearchAfter` |
| E5 | 1 | 1 | n1 PS:35 `Terms(Field(x=>x.Category))` (keyword, CI:65); n2 PS:338 `TermsAggregation{Field="category"}` (keyword, PI:212) |
| E6 | 1 | 1 | n1 PS:11-12,99 `MultiMatch` с `name.ru^3,name.en^3,description.*`; n2 PS:413-418 `name^3,name.en^3,description,description.en` |
| E7 | 1 | 1 | n1 CI:92-104,107-118 `BulkAsync` пачками 5000; n2 PI:258-263 `BulkAsync`, пачки 2000 |
| E8 | 1 | 1 | n1 CI:113 `!resp.Errors`, ретраи до 5, затем throw; n2 PI:264-266 то же, 4 попытки |
| E9 | 1 | 1 | n1 CI:122-145 `UpdateAliasesAsync` remove+add одним запросом, поиск через `Alias`; n2 PI:272-283, PS:325 читает `ProductIndexer.Alias` |
| E10 | n/a ? | n/a ? | reindex в выходе нет, пересборка из `ICatalogSource` Bulk-ом; но n1 CI:92 `Parallel.ForEachAsync` и n2 PI:229 4 параллельных писателя дают «Bulk в параллель», которое ключ допускает - при таком чтении было бы 1/1. Помечено n/a по указанию вызывающего; решает оператор |
| E11 | 1 | 1 | n1 CI:62-63,69-72 `russian` + подполе `en` `english`, поиск по обоим; n2 PI:198,201,209 `russian` + `.en` `english` |

Итог g-e: E1-E9, E11 - 2/2; E10 - n/a? (оба).

## rv-e (ревью). Файл-основание: elasticsearch/runs/rv-e-n{1,2}/REVIEW.md

| единица | n1 | n2 | основание |
|---|---|---|---|
| E1 | 1 | 1 | оба: ReindexService.cs:12, индекс без маппинга -> динамика, пропадёт keyword/strict (n1 blocker, n2 major) |
| E2 | 1 | 1 | оба: ProductSearch.cs:74 Term по analyzed `name`, точный поиск не находит |
| E3 | 1 | 1 | оба: ProductSearch.cs:54 сортировка по text, 500 |
| E4 | 1 | 1 ? | n1 ProductExport.cs:20 from/size, max_result_window 10000; n2 ProductExport.cs:15 (не :20-21 как в ключе, но тот же цикл выгрузки, последствие названо) |
| E5 | 1 | 1 | оба: ProductSearch.cs:48 terms по text `category`, /search -> 500 |
| E6 | 1 | 1 | оба: ProductSearch.cs:25 QueryString без fields, синтаксис ломает запрос (n1 ещё: ищет по всем полям) |
| E7 | 1 | 1 | оба: ProductIndexer.cs:41 по одному IndexAsync, часы |
| E8 | 1 | 1 | оба: ProductIndexer.cs:50 ответ Bulk не проверяется, документы теряются молча |
| E9 | 1 | 1 | n1 ProductIndexer.cs:10 static Current, реплики расходятся (+ нужен alias); n2 ReindexService.cs:23 static `Current` вместо alias, рестарт/реплика (ключ даёт оба места) |
| E10 | 1 | 1 | оба: ReindexService.cs:15 без slices, один поток, таймаут |
| E11 | 1 | 1 | оба: ProductIndexer.cs:28 standard для русского, нет стемминга |
| P1 | 1 | 1 | StatsAggregation по price (:49) не заявлена ни в одном |
| P2 | 1 | 1 | From/Size как глубина не заявлен; :45 заявлен только как O2 (смещение) |
| O1 | 1 | 1 | оба: ProductSearch.cs:24 пустой q -> ArgumentException -> 500 |
| O2 | 1 | 1 | оба: ProductSearch.cs:45 `From(page*PageSize)`, первая страница пропущена |

Итог rv-e: E1-E11, P1, P2, O1, O2 - 2/2 (E4 помечена ? только по номеру строки в n2).

## Итог по единицам (g-e + rv-e)
- E1-E9, E11: 4/4 (g-e 2/2 + rv-e 2/2; E4 rv n2 с «?» по строке).
- E10: g-e n/a? (оба), rv-e 2/2 -> 2/2 по клеткам, где есть.
- P1, P2, O1, O2: 2/2.
- Не-2/2 нет.

## Н (сверх ключа, кратко)
- rv n1/n2: /internal/* без авторизации (SearchEndpoints.cs:52), `ICatalogSource` не в DI (n1 :58), ошибка создания индекса при старте глотается (:17), `price` double (ProductIndexer.cs:31) - реальные.
- rv n1: фасеты внутри query вместо post_filter (ProductSearch.cs:61) - реальная, minor.
- g-e n1/n2: `ICatalogSource` не зарегистрирован в DI (сами признают в ANSWER.md); n1 `POST /search/reindex` без защиты, n2 `catalog-rebuild` лок-документ в ES (вне ключа). Код не собирался (оба признают).
