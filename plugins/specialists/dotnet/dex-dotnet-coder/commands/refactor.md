---
description: Анализ кода и предложения по рефакторингу для улучшения качества
allowed-tools: Read, Grep, Glob, Edit
argument-hint: [file-path или directory]
---

# /refactor

Анализ кода и предложения по рефакторингу для улучшения качества.

## Что проверяется

### 1. Code Smells

**Длинные методы (>50 строк):**
```csharp
// Плохо
public Order CreateOrder(CreateOrderRequest request)
{
    // 80 строк кода...
}

// Хорошо
public Order CreateOrder(CreateOrderRequest request)
{
    ValidateRequest(request);
    var customer = GetOrCreateCustomer(request.CustomerId);
    var items = MapOrderItems(request.Items);
    var order = new Order(customer, items);
    ApplyDiscount(order, request.DiscountCode);
    return order;
}
```

**Дублирование кода:**
- Найти повторяющиеся блоки
- Предложить извлечь в метод
- Использовать base class или interface

**Magic Numbers:**
```csharp
// Плохо
if (order.Total > 1000) { }

// Хорошо
private const decimal FreeShippingThreshold = 1000m;
if (order.Total > FreeShippingThreshold) { }
```

### 2. SOLID Violations

**Single Responsibility:**
```csharp
// OrderService делает слишком много
public class OrderService
{
    public void CreateOrder() { }
    public void SendEmail() { }      // не его ответственность
    public void ProcessPayment() { } // не его ответственность
}

// Разделить на сервисы
public class OrderService { }
public class EmailService { }
public class PaymentService { }
```

**Dependency Inversion:**
- Зависеть от интерфейсов, не реализаций
- Использовать DI контейнер

### 3. Performance Issues

**Async/Await:**
```csharp
// Блокирующий вызов
public Order GetOrder(int id)
{
    return _repository.GetByIdAsync(id).Result; // deadlock!
}

// Async all the way
public async Task<Order> GetOrderAsync(int id, CancellationToken ct)
{
    return await _repository.GetByIdAsync(id, ct);
}
```

**N+1 Queries:**
```csharp
// N+1
var orders = context.Orders.ToList();
foreach (var order in orders)
{
    var customer = context.Customers.Find(order.CustomerId);
}

// Eager Loading
var orders = context.Orders
    .Include(o => o.Customer)
    .ToList();
```

## Процесс

1. **Анализ файла или директории**
2. **Категоризация проблем:**
   - Критично (security, performance)
   - Важно (maintainability, SOLID)
   - Улучшение (стиль, читаемость)
3. **Приоритизация**
4. **Предложение исправлений с кодом**

## Вывод

```
Анализ OrderService.cs:

Критично (1):
- Async over sync (line 42): .Result блокирует поток
  Исправление: заменить на await

Важно (3):
- Длинный метод CreateOrder (85 строк): разбить на методы
- SRP нарушен: OrderService отправляет email
- Magic number 1000 (line 56): использовать константу

Улучшение (2):
- Имя переменной 'x' -> 'item' в LINQ
- Добавить XML комментарий к public методу

Оценка: 6.5/10
После рефакторинга: 9/10
```

## Действия

- Показать конкретный код ДО и ПОСЛЕ
- Создать ветку в GitLab для рефакторинга
- Сохранить обоснование в Notion
