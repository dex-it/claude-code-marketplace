---
name: linq-optimization
description: Оптимизация LINQ и коллекций. Активируется при linq, query, performance, collection, hashset, dictionary, slow query, IEnumerable
allowed-tools: Read, Grep, Glob
---

# LINQ & Collections Optimization

## Правила

- Фильтрация в БД (IQueryable), не в памяти (IEnumerable)
- Select проекция — загружай только нужные поля
- Any() вместо Count() > 0
- ToList() — только в конце цепочки
- Выбирай правильную коллекцию: List, HashSet, Dictionary
- Большие Contains() — batching или temporary table

## Анти-паттерны LINQ to Entities

```csharp
// Плохо — загружает ВСЮ таблицу, фильтрует в C#
var active = _context.Products.ToList().Where(p => p.IsActive);

// Хорошо — фильтр в SQL
var active = await _context.Products
    .Where(p => p.IsActive)
    .ToListAsync(ct);

// Плохо — ToList() в середине ломает IQueryable
var result = _context.Products
    .Where(p => p.IsActive)
    .ToList()                    // всё в память!
    .Where(p => p.Price > 100); // фильтр в C#

// Хорошо — вся цепочка IQueryable
var result = await _context.Products
    .Where(p => p.IsActive && p.Price > 100)
    .ToListAsync(ct);

// Плохо — загружает всю entity для списка
var products = await _context.Products.ToListAsync(ct);
return products.Select(p => new ProductDto(p.Id, p.Name));

// Хорошо — проекция в SQL
var products = await _context.Products
    .Select(p => new ProductDto(p.Id, p.Name))
    .ToListAsync(ct);

// Плохо — Count для проверки существования (считает ВСЕ)
if (await _context.Products.CountAsync(ct) > 0) { }

// Хорошо — Any останавливается на первом
if (await _context.Products.AnyAsync(ct)) { }

// Плохо — N запросов в цикле
foreach (var id in ids)
    await _context.Items.FindAsync(id);

// Хорошо — один запрос
var items = await _context.Items
    .Where(i => ids.Contains(i.Id))
    .ToListAsync(ct);

// Плохо — Contains с большим списком (>1000) генерирует огромный SQL IN(...)
var items = await _context.Items
    .Where(i => hugeList.Contains(i.Id)) // IN(@p1, @p2, ... @p5000)
    .ToListAsync(ct);

// Хорошо — batching
foreach (var batch in hugeList.Chunk(500))
{
    var batchItems = await _context.Items
        .Where(i => batch.Contains(i.Id))
        .ToListAsync(ct);
    result.AddRange(batchItems);
}
```

## Динамические запросы

```csharp
// Строй IQueryable условно, один ToListAsync в конце
IQueryable<Product> query = _context.Products;

if (minPrice.HasValue)
    query = query.Where(p => p.Price >= minPrice.Value);

if (!string.IsNullOrEmpty(category))
    query = query.Where(p => p.Category == category);

if (!string.IsNullOrEmpty(sortBy))
    query = sortBy switch
    {
        "price" => query.OrderBy(p => p.Price),
        "name" => query.OrderBy(p => p.Name),
        _ => query.OrderBy(p => p.Id)
    };

var result = await query
    .Skip((page - 1) * pageSize)
    .Take(pageSize)
    .ToListAsync(ct);
```

## GroupBy — осторожно

```csharp
// Плохо — GroupBy в EF может не транслироваться или работать в памяти
var grouped = await _context.Orders
    .GroupBy(o => o.CustomerId)
    .Select(g => new { CustomerId = g.Key, Orders = g.ToList() }) // client evaluation!
    .ToListAsync(ct);

// Хорошо — GroupBy только для агрегатов
var stats = await _context.Orders
    .GroupBy(o => o.CustomerId)
    .Select(g => new
    {
        CustomerId = g.Key,
        TotalAmount = g.Sum(o => o.Total),
        OrderCount = g.Count()
    })
    .ToListAsync(ct);

// Для загрузки вложенных коллекций — Include, не GroupBy
var customers = await _context.Customers
    .Include(c => c.Orders)
    .ToListAsync(ct);
```

## Выбор коллекции

| Задача | Коллекция | Почему |
|--------|-----------|--------|
| Последовательный доступ, индексация | `List<T>` | O(1) по индексу |
| Проверка наличия элемента | `HashSet<T>` | O(1) Contains vs O(n) List |
| Lookup по ключу | `Dictionary<K,V>` | O(1) доступ |
| FIFO очередь | `Queue<T>` | |
| LIFO стек | `Stack<T>` | |
| Потокобезопасность | `ConcurrentDictionary`, `ConcurrentQueue` | |

```csharp
// Плохо — List.Contains в горячем пути, O(n) на каждый вызов
var allowedIds = items.Select(i => i.Id).ToList();
foreach (var order in orders)
{
    if (allowedIds.Contains(order.ItemId)) { } // O(n) × M раз
}

// Хорошо — HashSet, O(1) lookup
var allowedIds = items.Select(i => i.Id).ToHashSet();
foreach (var order in orders)
{
    if (allowedIds.Contains(order.ItemId)) { } // O(1)
}

// Плохо — ищем по ключу в списке
var user = users.FirstOrDefault(u => u.Id == targetId); // O(n)

// Хорошо — Dictionary
var usersById = users.ToDictionary(u => u.Id);
var user = usersById.GetValueOrDefault(targetId); // O(1)
```

## LINQ to Objects — производительность

```csharp
// Плохо — многократная материализация IEnumerable
IEnumerable<Order> orders = GetOrders();
var count = orders.Count();        // итерация 1
var total = orders.Sum(o => o.Total); // итерация 2
var first = orders.First();        // итерация 3

// Хорошо — материализуй один раз
var ordersList = GetOrders().ToList();
var count = ordersList.Count;       // O(1)
var total = ordersList.Sum(o => o.Total);

// Плохо — Distinct() без IEqualityComparer для объектов
var unique = orders.Distinct(); // сравнивает по ссылке!

// Хорошо — DistinctBy (LINQ .NET 6+)
var unique = orders.DistinctBy(o => o.Id);
```

## Чек-лист

- [ ] Вся фильтрация в IQueryable, ToList/ToListAsync только в конце
- [ ] Select проекция для API responses и списков
- [ ] Any() вместо Count() > 0
- [ ] Нет N запросов в циклах (используй Contains/Include)
- [ ] Contains с большими списками — batching через Chunk
- [ ] HashSet/Dictionary для поиска по ключу вместо List
- [ ] GroupBy в EF — только для агрегатов (Sum, Count, Avg)
