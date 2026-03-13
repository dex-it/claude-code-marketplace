---
name: logging
description: Structured logging в .NET с Serilog. Активируется при serilog, seq, logging, structured logging, log, enricher, correlation id
allowed-tools: Read, Grep, Glob
---

# Logging — ловушки и anti-patterns

## Основные ловушки

### String interpolation вместо structured logging
Плохо: `_logger.LogInformation($"Order {orderId} created")`
Правильно: `_logger.LogInformation("Order {OrderId} created", orderId)`
Почему: строка аллоцируется ВСЕГДА, даже если уровень отключён. Structured logging подставляет параметры только при активном уровне + позволяет искать по свойствам в Seq

### Статический Log вместо ILogger<T>
Плохо: `Serilog.Log.Information("Something happened")`
Правильно: `_logger.LogInformation("Something happened")` через DI `ILogger<T>`
Почему: теряется категория (имя класса), невозможно переопределить MinimumLevel для конкретного namespace, не mockable в тестах

### ILogger вместо ILogger<T>
Плохо: `public MyService(ILogger logger)` — без generic параметра
Правильно: `public MyService(ILogger<MyService> logger)`
Почему: без `<T>` все логи идут в категорию "Default". Невозможно фильтровать по source в Seq: `SourceContext = 'MyService'`

### Пустой catch
Плохо: `catch (Exception) { }` — исключение проглочено молча
Правильно: логируй + пробрасывай: `catch (Exception ex) { _logger.LogError(ex, "..."); throw; }`
Почему: ошибка исчезает бесследно, дебаг превращается в гадание. Как минимум зафиксируй в логах

### Логируем но глотаем
Плохо: `catch (Exception ex) { _logger.LogError(ex, "Error"); }` — без `throw`
Правильно: `_logger.LogError(ex, "..."); throw;` — логируем И пробрасываем
Почему: вызывающий код считает операцию успешной. Данные повреждены/не сохранены, но ответ — 200 OK

### Дамп большого объекта
Плохо: `_logger.LogInformation("Request: {@Request}", httpRequest)` — весь HttpRequest в лог
Правильно: `_logger.LogInformation("Request {Method} {Path} ({SizeKb}kb)", method, path, size)`
Почему: JSON сериализация большого объекта = CPU + память, Seq/ELK раздувается, sensitive data может протечь через вложенные свойства

### Спам в цикле
Плохо: `foreach (var item in items) _logger.LogInformation("Processing {ItemId}", item.Id)`
Правильно: `_logger.LogInformation("Processing {Count} items for {OrderId}", items.Count, orderId)`
Почему: 10000 items = 10000 записей в Seq. Шум, за которым не видно реальных событий

## Semantic Types: @ vs $

```csharp
// @ — сериализует в JSON (для Seq)
_logger.LogInformation("Order: {@Order}", order);
// → {"Id": 123, "Total": 99.5}

// $ — вызывает ToString()
_logger.LogInformation("Order: {$Order}", order);
// → "Order #123"

// Без префикса — для примитивов
_logger.LogInformation("Order {OrderId} total: {Total:C}", id, total);
```

Ловушка: `@` на объекте без переопределённого `ToString()` или с circular references → StackOverflow или гигантский JSON

## Ошибки выбора Log Level

### Warning для штатной ситуации
Плохо: `_logger.LogWarning("Invalid input: {Field}", field)` — validation = нормально
Правильно: `_logger.LogDebug("Validation failed for {Field}: {Reason}", field, reason)`
Почему: Warning = что-то подозрительное, алерт-система засоряется штатными событиями

### Error без exception
Плохо: `_logger.LogError("Something failed for {OrderId}", orderId)` — где stack trace?
Правильно: `_logger.LogError(ex, "Failed to process order {OrderId}", orderId)`
Почему: без exception невозможно найти причину ошибки в Seq. Первый параметр Error — всегда Exception

### Information для отладки
Плохо: `_logger.LogInformation("Cache miss for key {Key}", key)` — в production это спам
Правильно: `_logger.LogDebug("Cache miss for key {Key}", key)`
Почему: Information включён в production, Debug — нет. Cache miss на каждый запрос = тысячи бесполезных записей

### Error для ожидаемой ситуации
Плохо: `_logger.LogError("User {UserId} not found")` — 404 это не ошибка
Правильно: `_logger.LogWarning("User {UserId} not found", userId)`
Почему: Error → алерт дежурному. User not found — штатная ситуация, не требует реакции

## Source Generators (Hot Paths)

```csharp
public static partial class LogMessages
{
    [LoggerMessage(EventId = 1001, Level = LogLevel.Information,
        Message = "Order {OrderId} created for customer {CustomerId}")]
    public static partial void OrderCreated(this ILogger logger, Guid orderId, Guid customerId);
}

// Вызов — zero-allocation, типобезопасный, без boxing
_logger.OrderCreated(order.Id, order.CustomerId);
```

Ловушка: EventId конфликты — два метода с одинаковым EventId компилируются, но в Seq/ELK невозможно отличить события. Используй уникальные EventId по диапазонам (Orders: 1000-1099, Users: 1100-1199)

## Sensitive Data

### PII в логах без маскирования
Плохо: `_logger.LogInformation("User {Email} from {Phone}", email, phone)`
Правильно: логируй `UserId`, не PII. Если нужен email — маскируй: `m***@gmail.com`
Почему: GDPR/ФЗ-152, логи хранятся годами, доступ к Seq/ELK шире чем к production БД

### Log.Fatal без flush
Плохо: `Log.Fatal("DB connection lost"); Environment.Exit(1)`
Правильно: `Log.Fatal("DB connection lost"); Log.CloseAndFlush(); Environment.Exit(1)`
Почему: Serilog буферизирует запись. Без `CloseAndFlush()` последнее (самое важное!) сообщение не доходит до Seq/файла

## Logger Scope

Плохо: повторять `{JobId}` в каждой строке лога внутри background job
Правильно: `using (_logger.BeginScope(new { JobId = jobId }))` — добавляет свойство ко ВСЕМ логам в блоке
Почему: без scope — дублирование, забытый JobId в одном вызове → невозможно связать лог с задачей в Seq

## Чек-лист

- Structured logging (не string interpolation)
- `ILogger<T>` через DI, не статический `Log`
- Sensitive data и PII — маскировать или не логировать
- Error логи содержат exception первым параметром
- Нет спама — логируем события, не итерации
- Hot paths используют LoggerMessage source generators
- `Log.CloseAndFlush()` перед завершением процесса
- MinimumLevel.Override для Microsoft/EF — Warning
