---
name: elasticsearch
description: Elasticsearch — mapping, queries, aggregations, ловушки. Активируется при elasticsearch, full-text search, kibana, opensearch, @elastic/elasticsearch, query DSL, inverted index, _search, _bulk, scroll API, ELK stack, Lucene, logstash, elastic agent
---

# Elasticsearch — ловушки и anti-patterns

## Mapping

### Dynamic mapping в production
Плохо: индексируешь документы без explicit mapping — ES угадывает типы
Правильно: `CreateIndexAsync` с явным `.Map<T>()` и `.Properties()` для каждого поля
Почему: `"price": "99.99"` маппится как text, Range query не работает. Исправление требует reindex всей коллекции

### Text vs Keyword перепутаны
Плохо: `Term` query по Text полю — `Term("Name", "Gaming Laptop")` не найдет ничего
Правильно: `Match` для Text полей, `Term` для Keyword полей
Почему: Text анализируется при индексации ("gaming", "laptop"), Term ищет exact match "Gaming Laptop" — не совпадает

### Text без .keyword sub-field
Плохо: Text поле без `.keyword` — нельзя использовать для sort и aggregation
Правильно: `.Text(t => t.Name(n => n.Name).Fields(f => f.Keyword(k => k.Name("keyword"))))`
Почему: Text поля не поддерживают sort/aggregation. Без sub-field потребуется reindex для добавления

## Запросы

### Deep pagination через From/Size
Плохо: `.From(10000).Size(20)` — ES держит в памяти 10020 документов для сортировки
Правильно: `SearchAfter` с sort values от последнего документа предыдущей страницы
Почему: From > 10000 — дефолтный лимит `max_result_window`. Даже при увеличении — O(from+size) по памяти и CPU

### Aggregation по Text полю
Плохо: `.Terms("categories", t => t.Field(f => f.Name))` — по Text полю
Правильно: aggregation по Keyword полю или `.keyword` sub-field: `t.Field("name.keyword")`
Почему: Text анализируется — "Gaming Laptop" считается как ["gaming", "laptop"], aggregation даст мусор

### _all field для поиска
Плохо: поиск без указания конкретных полей — запрос по всем полям документа
Правильно: `MultiMatch` с явным списком полей и boost: `.Fields(f => f.Field(p => p.Name, 2).Field(p => p.Description))`
Почему: поиск по всем полям замедляет запрос и дает нерелевантные результаты

## Индексация

### Индексация по одному документу
Плохо: `foreach (var p in products) await client.IndexDocumentAsync(p)` — N HTTP запросов
Правильно: `BulkAsync(b => b.Index("products").IndexMany(products))` + проверка `bulkResponse.Errors`
Почему: 10000 документов = 10000 roundtrip вместо 1. Bulk API на порядки быстрее

### Bulk без обработки partial failures
Плохо: `BulkAsync(...)` без проверки ответа — часть документов может не проиндексироваться
Правильно: проверять `bulkResponse.Errors` и итерировать `ItemsWithErrors`
Почему: Bulk API не атомарен — одни документы проиндексируются, другие нет. Без проверки потеря данных

## Reindex и алиасы

### Reindex без alias — downtime
Плохо: клиенты обращаются к индексу по имени `products-v1`, при reindex нужно менять код
Правильно: alias `products` → atomic switch: `BulkAliasAsync` (Remove old + Add new)
Почему: alias switch атомарен — zero downtime. Без alias каждый reindex требует координации деплоев

### Reindex больших индексов одним запросом
Плохо: `ReindexOnServerAsync` для индекса с миллионами документов без `slices`
Правильно: `Slices(5)` для параллельного reindex или `ScrollAsync` + `BulkAsync` батчами
Почему: один поток reindex на 100M документов займет часы. Sliced reindex параллелит работу

## Analyzers

### Язык без анализатора
Плохо: русский текст в поле с дефолтным `standard` analyzer
Правильно: `.Analyzer("russian")` для русского текста, `"english"` для английского
Почему: standard analyzer не делает стемминг для русского — "заказы" и "заказ" считаются разными словами

## Чек-лист

- Explicit mapping, не dynamic
- Text для поиска, Keyword для фильтрации/sort/agg
- Alias для zero-downtime reindex
- Bulk API для массовой индексации + проверка Errors
- Search After для deep pagination (не From > 10000)
- Analyzers для языка (russian, english)
