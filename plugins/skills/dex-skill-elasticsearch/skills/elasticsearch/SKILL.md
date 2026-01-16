---
name: elasticsearch-patterns
description: Elasticsearch в .NET - NEST клиент, mapping, queries, aggregations, индексация. Активируется при elasticsearch, elastic, search, full-text search, NEST, lucene, aggregation, index, mapping, query DSL
allowed-tools: Read, Grep, Glob
---

# Elasticsearch Patterns в .NET

## Подключение с NEST

### Настройка клиента

```csharp
// Program.cs
var settings = new ConnectionSettings(new Uri("http://localhost:9200"))
    .DefaultIndex("products")
    .EnableDebugMode()
    .PrettyJson()
    .RequestTimeout(TimeSpan.FromMinutes(2));

services.AddSingleton<IElasticClient>(new ElasticClient(settings));
```

### С аутентификацией

```csharp
var settings = new ConnectionSettings(new Uri("https://elasticsearch:9200"))
    .BasicAuthentication("elastic", "password")
    .ServerCertificateValidationCallback(CertificateValidations.AllowAll)
    .DefaultIndex("products");
```

## Mapping (Маппинг)

### Атрибутами

```csharp
[ElasticsearchType(IdProperty = nameof(Id))]
public class Product
{
    [Keyword]
    public string Id { get; set; }

    [Text(Analyzer = "russian")]
    public string Name { get; set; }

    [Text(Analyzer = "russian")]
    public string Description { get; set; }

    [Keyword]
    public string Category { get; set; }

    [Number(NumberType.Double)]
    public decimal Price { get; set; }

    [Date(Format = "strict_date_optional_time")]
    public DateTime CreatedAt { get; set; }

    [Nested]
    public List<ProductAttribute> Attributes { get; set; }

    [Boolean]
    public bool IsActive { get; set; }

    [GeoPoint]
    public GeoLocation Location { get; set; }
}

public class ProductAttribute
{
    [Keyword]
    public string Name { get; set; }

    [Keyword]
    public string Value { get; set; }
}
```

### Fluent Mapping

```csharp
await client.Indices.CreateAsync("products", c => c
    .Settings(s => s
        .NumberOfShards(3)
        .NumberOfReplicas(2)
        .Analysis(a => a
            .Analyzers(an => an
                .Custom("russian_custom", ca => ca
                    .Tokenizer("standard")
                    .Filters("lowercase", "russian_stop", "russian_stemmer")))))
    .Map<Product>(m => m
        .AutoMap()
        .Properties(p => p
            .Text(t => t
                .Name(n => n.Name)
                .Analyzer("russian_custom")
                .Fields(f => f
                    .Keyword(k => k.Name("keyword"))))
            .Keyword(k => k.Name(n => n.Category))
            .Nested<ProductAttribute>(n => n
                .Name(na => na.Attributes)
                .Properties(np => np
                    .Keyword(k => k.Name(a => a.Name))
                    .Keyword(k => k.Name(a => a.Value)))))));
```

## Индексация

### Один документ

```csharp
var product = new Product { Id = "1", Name = "Laptop", Price = 999.99m };

var response = await client.IndexDocumentAsync(product);
// или
var response = await client.IndexAsync(product, i => i.Index("products").Id(product.Id));
```

### Bulk Indexing

```csharp
var products = GetProducts();

var bulkResponse = await client.BulkAsync(b => b
    .Index("products")
    .IndexMany(products));

if (bulkResponse.Errors)
{
    foreach (var item in bulkResponse.ItemsWithErrors)
    {
        _logger.LogError("Failed to index document {Id}: {Error}",
            item.Id, item.Error.Reason);
    }
}
```

### Bulk с BulkDescriptor

```csharp
var descriptor = new BulkDescriptor();

foreach (var product in products)
{
    descriptor.Index<Product>(op => op
        .Document(product)
        .Index("products")
        .Id(product.Id));
}

// Также можно update и delete
descriptor.Update<Product>(op => op.Id("123").Doc(updatedProduct));
descriptor.Delete<Product>(op => op.Id("456"));

await client.BulkAsync(descriptor);
```

## Запросы (Queries)

### Match Query (полнотекстовый)

```csharp
var response = await client.SearchAsync<Product>(s => s
    .Query(q => q
        .Match(m => m
            .Field(f => f.Name)
            .Query("красный телефон")
            .Operator(Operator.And)
            .Fuzziness(Fuzziness.Auto))));
```

### Multi-Match Query

```csharp
var response = await client.SearchAsync<Product>(s => s
    .Query(q => q
        .MultiMatch(mm => mm
            .Fields(f => f
                .Field(p => p.Name, boost: 2)
                .Field(p => p.Description))
            .Query(searchText)
            .Type(TextQueryType.BestFields)
            .Fuzziness(Fuzziness.Auto))));
```

### Bool Query (комбинирование)

```csharp
var response = await client.SearchAsync<Product>(s => s
    .Query(q => q
        .Bool(b => b
            .Must(
                m => m.Match(ma => ma.Field(f => f.Name).Query(searchText)),
                m => m.Range(r => r.Field(f => f.Price).GreaterThanOrEquals(minPrice)))
            .Filter(
                f => f.Term(t => t.Field(p => p.Category).Value(category)),
                f => f.Term(t => t.Field(p => p.IsActive).Value(true)))
            .Should(
                s => s.Match(m => m.Field(f => f.Description).Query(searchText)))
            .MinimumShouldMatch(1))));
```

### Term и Terms Query (точное совпадение)

```csharp
// Один термин
.Query(q => q.Term(t => t.Field(f => f.Category).Value("electronics")))

// Несколько терминов
.Query(q => q.Terms(t => t
    .Field(f => f.Category)
    .Terms("electronics", "computers", "phones")))
```

### Range Query

```csharp
.Query(q => q
    .Range(r => r
        .Field(f => f.Price)
        .GreaterThanOrEquals(100)
        .LessThanOrEquals(500)))

// Для дат
.Query(q => q
    .DateRange(dr => dr
        .Field(f => f.CreatedAt)
        .GreaterThanOrEquals("2024-01-01")
        .LessThanOrEquals(DateMath.Now)))
```

### Nested Query

```csharp
.Query(q => q
    .Nested(n => n
        .Path(p => p.Attributes)
        .Query(nq => nq
            .Bool(b => b
                .Must(
                    m => m.Term(t => t.Field("attributes.name").Value("color")),
                    m => m.Term(t => t.Field("attributes.value").Value("red")))))))
```

## Пагинация и сортировка

```csharp
var response = await client.SearchAsync<Product>(s => s
    .From((page - 1) * pageSize)
    .Size(pageSize)
    .Sort(so => so
        .Descending(p => p.CreatedAt)
        .Ascending(p => p.Name.Suffix("keyword")))
    .Query(q => q.MatchAll()));

// Search After для глубокой пагинации
var response = await client.SearchAsync<Product>(s => s
    .Size(100)
    .Sort(so => so.Ascending(p => p.Id))
    .SearchAfter(lastDocumentSortValues)
    .Query(q => q.MatchAll()));
```

## Aggregations (Агрегации)

### Terms Aggregation

```csharp
var response = await client.SearchAsync<Product>(s => s
    .Size(0)  // Только агрегации
    .Aggregations(a => a
        .Terms("categories", t => t
            .Field(f => f.Category)
            .Size(10)
            .Order(o => o.CountDescending()))));

var categories = response.Aggregations.Terms("categories");
foreach (var bucket in categories.Buckets)
{
    Console.WriteLine($"{bucket.Key}: {bucket.DocCount}");
}
```

### Range Aggregation

```csharp
.Aggregations(a => a
    .Range("price_ranges", r => r
        .Field(f => f.Price)
        .Ranges(
            ra => ra.To(100).Key("cheap"),
            ra => ra.From(100).To(500).Key("medium"),
            ra => ra.From(500).Key("expensive"))))
```

### Nested Aggregations

```csharp
.Aggregations(a => a
    .Terms("categories", t => t
        .Field(f => f.Category)
        .Aggregations(aa => aa
            .Average("avg_price", avg => avg.Field(f => f.Price))
            .Max("max_price", max => max.Field(f => f.Price)))))
```

### Stats Aggregation

```csharp
.Aggregations(a => a
    .Stats("price_stats", st => st.Field(f => f.Price)))

var stats = response.Aggregations.Stats("price_stats");
Console.WriteLine($"Min: {stats.Min}, Max: {stats.Max}, Avg: {stats.Average}");
```

## Highlighting

```csharp
var response = await client.SearchAsync<Product>(s => s
    .Query(q => q.Match(m => m.Field(f => f.Description).Query(searchText)))
    .Highlight(h => h
        .PreTags("<em>")
        .PostTags("</em>")
        .Fields(
            f => f.Field(p => p.Name),
            f => f.Field(p => p.Description))));

foreach (var hit in response.Hits)
{
    var highlights = hit.Highlight;
    if (highlights.ContainsKey("description"))
    {
        Console.WriteLine(string.Join(" ... ", highlights["description"]));
    }
}
```

## Suggestions (Автодополнение)

### Completion Suggester

```csharp
// Mapping
.Properties(p => p
    .Completion(c => c
        .Name(n => n.Suggest)
        .Analyzer("simple")))

// Индексация
var product = new Product
{
    Name = "iPhone 15",
    Suggest = new CompletionField
    {
        Input = new[] { "iPhone", "iPhone 15", "Apple iPhone" },
        Weight = 10
    }
};

// Запрос
var response = await client.SearchAsync<Product>(s => s
    .Suggest(su => su
        .Completion("product-suggest", c => c
            .Field(f => f.Suggest)
            .Prefix("iph")
            .Fuzzy(f => f.Fuzziness(Fuzziness.Auto))
            .Size(5))));
```

## Health Check

```csharp
builder.Services.AddHealthChecks()
    .AddElasticsearch(elasticsearchUri: "http://localhost:9200", name: "elasticsearch");
```

## Best Practices

### 1. Reindex без downtime

```csharp
// 1. Создать alias
await client.Indices.CreateAsync("products-v1");
await client.Indices.PutAliasAsync("products-v1", "products");

// 2. Переиндексация
await client.Indices.CreateAsync("products-v2");
await client.ReindexOnServerAsync(r => r
    .Source(s => s.Index("products-v1"))
    .Destination(d => d.Index("products-v2")));

// 3. Переключить alias
await client.Indices.BulkAliasAsync(b => b
    .Remove(r => r.Index("products-v1").Alias("products"))
    .Add(a => a.Index("products-v2").Alias("products")));
```

### 2. Scroll для больших выборок

```csharp
var searchResponse = await client.SearchAsync<Product>(s => s
    .Size(1000)
    .Scroll("1m")
    .Query(q => q.MatchAll()));

while (searchResponse.Documents.Any())
{
    foreach (var doc in searchResponse.Documents)
    {
        ProcessDocument(doc);
    }

    searchResponse = await client.ScrollAsync<Product>("1m", searchResponse.ScrollId);
}

await client.ClearScrollAsync(c => c.ScrollId(searchResponse.ScrollId));
```
