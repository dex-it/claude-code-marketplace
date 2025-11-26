---
name: linq-optimization
description: Оптимизация LINQ запросов, производительность, best practices. Активируется при linq, query, performance, optimization, slow query
allowed-tools: Read, Grep, Glob
---

# LINQ Optimization

## LINQ to Objects vs LINQ to Entities

```csharp
// LINQ to Entities - переводится в SQL
var result = await _context.Products
    .Where(p => p.Price > 100)
    .ToListAsync(ct);
// SQL: SELECT * FROM Products WHERE Price > 100

// LINQ to Objects - выполняется в памяти
var products = GetProductsFromMemory();
var result = products.Where(p => p.Price > 100).ToList();
```

## Фильтрация в БД, не в памяти

```csharp
// Плохо - загружает ВСЕ в память
var products = _context.Products.ToList();
var filtered = products.Where(p => p.Price > 100);

// Хорошо - фильтрует в БД
var filtered = await _context.Products
    .Where(p => p.Price > 100)
    .ToListAsync(ct);
```

## Проекция (Select)

```csharp
// Плохо - загружает всю entity
var products = await _context.Products.ToListAsync();
var names = products.Select(p => p.Name);

// Хорошо - загружает только Name из БД
var names = await _context.Products
    .Select(p => p.Name)
    .ToListAsync(ct);

// DTO проекция
var dtos = await _context.Products
    .Select(p => new ProductDto
    {
        Id = p.Id,
        Name = p.Name
    })
    .ToListAsync(ct);
```

## Any vs Count

```csharp
// Медленно - считает все
if (await _context.Products.CountAsync() > 0) { }

// Быстро - останавливается на первом
if (await _context.Products.AnyAsync(ct)) { }
```

## Пагинация

```csharp
var items = await query
    .OrderBy(p => p.Id)  // ВАЖНО: нужна сортировка!
    .Skip((page - 1) * pageSize)
    .Take(pageSize)
    .ToListAsync(ct);
```

## Избегать ToList() в середине

```csharp
// Плохо - дальнейшая фильтрация в памяти
var products = _context.Products
    .Where(p => p.IsActive)
    .ToList()                    // загружает в память
    .Where(p => p.Price > 100);  // фильтрует в памяти!

// Хорошо - всю фильтрацию в БД
var products = await _context.Products
    .Where(p => p.IsActive)
    .Where(p => p.Price > 100)
    .ToListAsync(ct);
```

## Динамические запросы

```csharp
IQueryable<Product> query = _context.Products;

if (minPrice.HasValue)
    query = query.Where(p => p.Price >= minPrice.Value);

if (!string.IsNullOrEmpty(category))
    query = query.Where(p => p.Category == category);

var result = await query.ToListAsync(ct);
```

## Антипаттерны

```csharp
// Загружать все для Count
var count = _context.Products.ToList().Count;
// Правильно:
var count = await _context.Products.CountAsync(ct);

// Множество запросов в цикле
foreach (var id in ids)
{
    var item = await _context.Items.FindAsync(id); // N запросов!
}
// Правильно:
var items = await _context.Items
    .Where(i => ids.Contains(i.Id))
    .ToListAsync(ct);
```
