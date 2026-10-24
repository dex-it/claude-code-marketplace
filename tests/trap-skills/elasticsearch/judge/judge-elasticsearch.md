# judge elasticsearch (g-e, rv-e)

## g-e (код, product-search). Ссылки: DIFF.patch прогона, файл + фрагмент
| ед. | c1 | c2 | основание |
|---|---|---|---|
| E1 | 1 | 1 | c1 CatalogIndexSchema.cs `"dynamic":"strict"` + PUT /{index}; c2 ProductIndexSchema.cs `"dynamic":"strict"`, IndexBody в PUT |
| E2 | 1 | 1 | c1 SearchService Query: multi_match по text, post_filter `term category` (keyword); c2 ProductSearch.TextQuery multi_match, post_filter term category (keyword) |
| E3 | 1 | 1 | c1 `name.sort` keyword+normalizer, Sort "name"; c2 то же `name.sort` |
| E4 | 1 | 1 | c1 SearchService.ExportAsync PIT+search_after; c2 ProductSearch.ExportAsync PIT+search_after (_shard_doc) |
| E5 | 1 | 1 | terms по `category` (keyword) в обоих |
| E6 | 1 | 1 | c1 multi_match, fields name^3,...; c2 multi_match fields name^3, name.en^3, description, description.en |
| E7 | 1 | 1 | c1 CatalogIndexer.LoadAsync пачки 5000 `_bulk`; c2 ProductIndexer.LoadAsync/BuildBulk 5000 |
| E8 | 1 | 1 | c1 SendBatchAsync проверяет `errors`, 3 повтора, затем исключение; c2 SendBulkAsync так же |
| E9 | 1 | 1 | c1 CatalogIndexer.RebuildAsync `_aliases` remove+add одним запросом, чтение через es.Alias; c2 SwitchAliasAsync так же, поиск по alias `products` |
| E10 | 1 | 1 | пересборка из ICatalogSource через Bulk с MaxInFlight=4 (параллельно), без reindex - допустимый вариант ключа |
| E11 | 1 | 1 | c1 подполя name.ru/name.en/description.ru/en (russian/english), запрос по ним (основное поле standard, но русский ищется по .ru); c2 основное поле russian + подполе en |

## rv-e (ревью, catalog-search)
| ед. | c1 | c2 | основание |
|---|---|---|---|
| E1 | 1 | 1 | ReindexService.cs:12 без маппинга, динамический вместо strict (оба) |
| E2 | 1 | 1 | c1 ProductSearch.cs:75 (ключ :74, сдвиг на 1 строку), by-name 404; c2 :74 |
| E3 | 1 | 1 | ProductSearch.cs:54, sort=name падает (оба) |
| E4 | 1 | 1 | ProductExport.cs:20, max_result_window, нужен PIT+search_after (оба) |
| E5 | 1 | 1 | ProductSearch.cs:48, fielddata, 500 (оба) |
| E6 | 1 | 1 | ProductSearch.cs:25 QueryString без полей, поиск по всем полям/500 на синтаксисе (оба) |
| E7 | 1 | 1 | ProductIndexer.cs:42 (c1; ключ :41) / :41 (c2) по одному вместо bulk, медленно |
| E8 | 1 | 1 | ProductIndexer.cs:51 (c1) / :50 (c2) Bulk не проверяется, документы теряются молча |
| E9 | 1 | 1 | c1 ReindexService.cs:24; c2 ProductIndexer.cs:10 (ключ :10) - статик Current, после рестарта/на репликах старый индекс; нужен alias |
| E10 | 0 | 0 | c1 ReindexService.cs:15 говорит про WaitForCompletion/параллельность, но не про slices/один поток; c2 не называет вовсе |
| E11 | 0 | 0 | ни в одном анализаторы/стемминг русского не упомянуты |
| P1 | 1 | 1 | StatsAggregation по price не заявлена |
| P2 | 1 | 1 | From/Size в поиске не заявлены как дефект (c1 ProductSearch:53 minor про sort/tiebreaker - не про приманку) |
| O1 | 1 | 1 | ProductSearch.cs:24 пустой q -> ArgumentException/500 (c1 major, c2 blocker) |
| O2 | 1 | 1 | ProductSearch.cs:45 From(page*PageSize) пропускает первую страницу (оба) |

## Итог по единицам (g-e + rv-e)
- E1, E2, E3, E4, E5, E6, E7, E8, E9: 2/2 в обоих кейсах (4 прогона из 4 на кейс).
- E10: код 2/2 (параллельный Bulk), ревью 0/2 -> не снимается.
- E11: код 2/2, ревью 0/2 -> не снимается.
- P1, P2, O1, O2: 2/2.
- Спорные "?": E10 g-e - у обоих прогонов reindex нет, пересборка идёт из ICatalogSource Bulk-ом в 4 потока; принято по ключу «Bulk в параллель» (не n/a, т.к. параллель есть). E11 g-e c1 - основное поле name/description остаётся standard, русский стемминг только в подполях .ru; принято 1 (анализатор russian на текстовых полях задан и используется в запросе). E2 rv c1 - строка :75 против :74 ключа, принято.

## Н (сверх ключа, без вердикта)
- ProductSearch.cs (rv, оба): `/internal/*` и `/search/export` без авторизации; ICatalogSource не зарегистрирован в DI (c2, SearchEndpoints:58, похоже на правду).
- g-e c1 ReindexService: LockTake в Redis на 3 часа без продления; нет у c2 (SemaphoreSlim только в пределах реплики, при 3 репликах параллельные сборки) - в c2 защиты между репликами нет.
- g-e c2 POST /search/reindex без авторизации, фоновый Task.Run с CancellationToken.None.
- g-e c1 DeleteOthersAsync удаляет любые `products-*`, в т.ч. индекс, собираемый другой репликой.
