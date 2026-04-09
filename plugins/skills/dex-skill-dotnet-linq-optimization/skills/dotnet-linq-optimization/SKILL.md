---
name: dotnet-linq-optimization
description: LINQ и коллекции — ловушки производительности. Активируется при linq, query, collection, hashset, dictionary, IEnumerable, IQueryable, ToList, Any, Count, GroupBy, FirstOrDefault, Select, Where
---

# LINQ & Collections — ловушки

## LINQ to Entities

### ToList() в начале цепочки — фильтрация в памяти
Плохо: `_context.Products.ToList().Where(p => p.IsActive)` — загружает ВСЮ таблицу, фильтрует в C#
Правильно: `.Where(p => p.IsActive).ToListAsync(ct)` — фильтр в SQL
Почему: 100K строк в память вместо 500. ToList() в середине цепочки тоже обрывает IQueryable

### Загружает всю entity для списка
Плохо: `_context.Products.ToListAsync()` → потом `.Select(p => new Dto(p.Id, p.Name))`
Правильно: `.Select(p => new ProductDto(p.Id, p.Name)).ToListAsync()` — проекция в SQL
Почему: грузишь 20 полей × 1000 строк вместо 2 полей. SQL тяжелее, трафик больше, Change Tracker раздувается

### Count() > 0 вместо Any()
Плохо: `_context.Products.CountAsync() > 0` — считает ВСЕ записи
Правильно: `_context.Products.AnyAsync()` — EXISTS, останавливается на первом
Почему: COUNT(*) проходит всю таблицу/индекс. EXISTS останавливается сразу

### N запросов в цикле
Плохо: `foreach (var id in ids) await _context.Items.FindAsync(id)` — N запросов
Правильно: `_context.Items.Where(i => ids.Contains(i.Id)).ToListAsync()`
Почему: 100 id = 100 roundtrip к БД. Один WHERE IN = один roundtrip

### Contains с огромным списком
Плохо: `ids.Contains(i.Id)` где ids = 5000 элементов → `IN(@p1, @p2, ... @p5000)` в SQL
Правильно: batching через `ids.Chunk(500)` и отдельный запрос на каждый batch
Почему: SQL Server параметры ограничены (~2100), PostgreSQL — план запроса деградирует на тысячах параметров

### GroupBy с ToList() внутри Select
Плохо: `.GroupBy(o => o.CustomerId).Select(g => new { Key = g.Key, Orders = g.ToList() })` — client evaluation
Правильно: GroupBy только для агрегатов: `.Select(g => new { g.Key, Total = g.Sum(o => o.Total), Count = g.Count() })`
Почему: EF не умеет транслировать g.ToList() в SQL → загружает всё в память. Для вложенных коллекций — Include

## LINQ to Objects

### List.Contains в горячем пути — O(n)
Плохо: `allowedIds.ToList()` → `foreach: if (allowedIds.Contains(id))` — O(n) × M раз
Правильно: `allowedIds.ToHashSet()` → O(1) lookup
Почему: List.Contains = линейный поиск. 10000 элементов × 10000 проверок = 100M операций вместо 10000

### FirstOrDefault вместо Dictionary
Плохо: `users.FirstOrDefault(u => u.Id == targetId)` — O(n) каждый вызов
Правильно: `users.ToDictionary(u => u.Id)` → `dict.GetValueOrDefault(targetId)` — O(1)
Почему: повторный линейный поиск по списку. Если ищешь больше одного раза — Dictionary окупается

### Многократная итерация IEnumerable
Плохо: `orders.Count()` + `orders.Sum(...)` + `orders.First()` — 3 итерации источника
Правильно: `var list = orders.ToList()` — материализуй один раз
Почему: IEnumerable может быть lazy (запрос к БД, файл). Каждая итерация = повторное выполнение

### Distinct() на объектах — сравнение по ссылке
Плохо: `orders.Distinct()` — не удаляет дубликаты (сравнивает ReferenceEquals)
Правильно: `orders.DistinctBy(o => o.Id)` (.NET 6+) или `IEqualityComparer<T>`
Почему: без override Equals/GetHashCode или компаратора Distinct бесполезен для reference types

## Динамические запросы — ловушка

### ToListAsync() в каждой ветке условия
Плохо: `if (filter) return await query.Where(...).ToListAsync(); else return await query.ToListAsync();`
Правильно: строй IQueryable условно, один `ToListAsync()` в конце
Почему: дублирование материализации. Каждая ветка = отдельный путь с потенциально разной пагинацией/сортировкой
