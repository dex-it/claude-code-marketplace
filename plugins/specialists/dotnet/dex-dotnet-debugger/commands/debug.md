---
description: Помощь в отладке - анализ stack trace, логов, исключений
allowed-tools: Read, Grep, Glob, Bash
argument-hint: [stack-trace или описание ошибки]
---

# /debug

Помощь в отладке: анализ stack trace, логов, исключений.

## Сценарии

### 1. Анализ Exception

Когда пользователь предоставляет stack trace:

```
System.NullReferenceException: Object reference not set to an instance of an object
   at MyApp.Services.OrderService.CalculateTotal(Order order) in OrderService.cs:line 42
   at MyApp.Controllers.OrderController.CreateOrder(CreateOrderRequest request)
```

**Анализ:**
1. Открыть файл OrderService.cs:42
2. Найти переменную, которая может быть null
3. Проверить откуда приходит значение
4. Предложить исправление с null-check

### 2. Отладка БД запроса

Используя Supabase MCP:
```sql
-- Посмотреть медленные запросы
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

Анализ N+1 проблемы:
- Найти код с циклами и запросами
- Предложить `.Include()` или `.ThenInclude()`
- Показать оптимизированный вариант

### 3. Проверка логов

- Поиск ошибок за последний час
- Корреляция по request ID
- Выявление паттернов

## Вывод

```
Анализ NullReferenceException:

Файл: OrderService.cs:42
Код: decimal total = order.Items.Sum(x => x.Price);

Проблема: order.Items может быть null

Исправление:
decimal total = order.Items?.Sum(x => x.Price) ?? 0;

Или лучше:
if (order?.Items == null || !order.Items.Any())
    throw new ArgumentException("Order must have items");

decimal total = order.Items.Sum(x => x.Price);
```

## Интеграция

- Документировать решение в Notion
- Создать issue в GitLab если это баг
- Предложить добавить unit тест для этого кейса
