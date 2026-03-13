---
name: elasticsearch
description: Elasticsearch — mapping, queries, aggregations, ловушки. Активируется при elasticsearch, elastic, NEST, full-text search, mapping, aggregation
allowed-tools: Read, Grep, Glob
---

# Elasticsearch Patterns

## Правила

- Keyword для точного совпадения, Text для полнотекстового поиска
- Mapping задавай явно — не полагайся на dynamic mapping в production
- Alias для zero-downtime reindex
- Scroll / Search After для больших выборок, не From/Size > 10000
- Bulk API для массовой индексации
- Не используй `_all` field — укажи конкретные поля для поиска

## Анти-паттерны

```csharp
// Плохо — dynamic mapping, Elasticsearch угадывает типы
// "price": "99.99" → mapped as text, не как number!
// Потом Range query не работает

// Хорошо — explicit mapping
await client.Indices.CreateAsync("products", c => c
    .Map<Product>(m => m
        .Properties(p => p
            .Text(t => t.Name(n => n.Name).Analyzer("russian")
                .Fields(f => f.Keyword(k => k.Name("keyword")))) // для точного match и sort
            .Keyword(k => k.Name(n => n.Category))                // только точное совпадение
            .Number(n => n.Name(p => p.Price).Type(NumberType.Double))
            .Date(d => d.Name(p => p.CreatedAt)))));

// Плохо — deep pagination убивает performance
var response = await client.SearchAsync<Product>(s => s
    .From(10000)  // ES держит в памяти 10000 + size документов!
    .Size(20));

// Хорошо — Search After для глубокой пагинации
var response = await client.SearchAsync<Product>(s => s
    .Size(100)
    .Sort(so => so.Ascending(p => p.Id))
    .SearchAfter(lastDocumentSortValues));

// Плохо — Term query для Text поля
.Query(q => q.Term(t => t.Field(f => f.Name).Value("Gaming Laptop")))
// Name = Text → анализируется → "gaming laptop" в индексе
// Term ищет exact "Gaming Laptop" → не найдёт!

// Хорошо — Match для Text, Term для Keyword
.Query(q => q.Match(m => m.Field(f => f.Name).Query("Gaming Laptop")))     // Text
.Query(q => q.Term(t => t.Field(f => f.Category).Value("electronics")))    // Keyword

// Плохо — индексация по одному документу
foreach (var product in products)
    await client.IndexDocumentAsync(product); // N HTTP запросов

// Хорошо — Bulk API
var bulkResponse = await client.BulkAsync(b => b.Index("products").IndexMany(products));
if (bulkResponse.Errors)
    foreach (var item in bulkResponse.ItemsWithErrors)
        _logger.LogError("Failed to index {Id}: {Error}", item.Id, item.Error.Reason);
```

## Text vs Keyword

| Тип | Анализ | Запрос | Когда |
|-----|--------|--------|-------|
| Text | Токенизация + стемминг | Match, MultiMatch | Полнотекстовый поиск |
| Keyword | Как есть | Term, Terms | Фильтрация, sort, aggregation |
| Text + `.keyword` | Оба | Оба | Поиск + фильтрация/sort |

## Reindex без downtime

```csharp
// 1. Alias → старый индекс
await client.Indices.PutAliasAsync("products-v1", "products");

// 2. Создать новый индекс + reindex
await client.Indices.CreateAsync("products-v2", /* new mapping */);
await client.ReindexOnServerAsync(r => r
    .Source(s => s.Index("products-v1"))
    .Destination(d => d.Index("products-v2")));

// 3. Atomic switch alias
await client.Indices.BulkAliasAsync(b => b
    .Remove(r => r.Index("products-v1").Alias("products"))
    .Add(a => a.Index("products-v2").Alias("products")));
// Клиенты работают через alias — downtime = 0
```

## Aggregations — ловушки

```csharp
// Плохо — aggregation по Text полю
.Aggregations(a => a.Terms("categories", t => t.Field(f => f.Name)))
// Text → анализируется → "Gaming Laptop" считается как ["gaming", "laptop"]

// Хорошо — aggregation по Keyword
.Aggregations(a => a.Terms("categories", t => t.Field(f => f.Category))) // Keyword
// или через .keyword sub-field:
.Aggregations(a => a.Terms("names", t => t.Field("name.keyword")))
```

## Чек-лист

- [ ] Explicit mapping, не dynamic
- [ ] Text для поиска, Keyword для фильтрации/sort/agg
- [ ] Alias для zero-downtime reindex
- [ ] Bulk API для массовой индексации
- [ ] Search After для deep pagination (не From > 10000)
- [ ] Analyzers для языка (russian, english)
