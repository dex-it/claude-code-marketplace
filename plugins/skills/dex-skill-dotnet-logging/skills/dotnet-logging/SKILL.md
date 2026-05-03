---
name: dotnet-logging
description: .NET structured logging — Serilog, ILogger, Seq. Активируется при serilog, seq, ILogger, log level, correlation, LogError, LogWarning, PII, пустой catch, необработанное исключение, опциональный шаг, side-feature, спам логов
---

# Logging — ловушки и anti-patterns

## Structured Logging

### String interpolation вместо structured logging
Плохо: `_logger.LogInformation($"Order {orderId} created")`
Правильно: `_logger.LogInformation("Order {OrderId} created", orderId)`
Почему: строка аллоцируется ВСЕГДА, даже если уровень отключен. Structured logging подставляет параметры только при активном уровне + позволяет искать по свойствам в Seq

### Статический Log вместо ILogger<T>
Плохо: `Serilog.Log.Information("Something happened")`
Правильно: `_logger.LogInformation("Something happened")` через DI `ILogger<T>`
Почему: теряется категория (имя класса), невозможно переопределить MinimumLevel для конкретного namespace, не mockable в тестах

### ILogger вместо ILogger<T>
Плохо: `public MyService(ILogger logger)` — без generic параметра
Правильно: `public MyService(ILogger<MyService> logger)`
Почему: без `<T>` все логи идут в категорию "Default". Невозможно фильтровать по source в Seq: `SourceContext = 'MyService'`

## Exception Handling

### Пустой catch
Плохо: `catch (Exception) { }` — исключение проглочено молча
Правильно: `catch (Exception ex) { _logger.LogError(ex, "..."); throw; }`
Почему: ошибка исчезает бесследно, дебаг превращается в гадание. Как минимум зафиксируй в логах

### Логируем но глотаем
Плохо: `catch (Exception ex) { _logger.LogError(ex, "Error"); }` — без `throw`
Правильно: `_logger.LogError(ex, "..."); throw;` — логируем И пробрасываем
Почему: вызывающий код считает операцию успешной. Данные повреждены/не сохранены, но ответ 200 OK

### Error без exception объекта
Плохо: `_logger.LogError("Something failed for {OrderId}", orderId)` — где stack trace?
Правильно: `_logger.LogError(ex, "Failed to process order {OrderId}", orderId)`
Почему: без exception невозможно найти причину ошибки в Seq. Первый параметр Error — всегда Exception

### Нет обёртки вокруг некритичной операции
Плохо: внутри основного флоу прямой вызов вспомогательной операции (сбор метрик, аналитика, side-feature), у которой может бросить исключение, и выше по стеку нет общего обработчика
Правильно: `try { await OptionalStep(); } catch (Exception ex) { _logger.LogError(ex, "..."); return; }` — залогируй и выйди, не пробрасывай
Почему: side-feature не должна валить основной сценарий. Без обёртки одно исключение из опционального шага кладёт весь handler/pipeline. Правило: для каждого вызова в коде — «должен ли этот шаг ронять основной флоу? если нет — обернуть в try/catch + log + return»

> Для разделения обязательных и опциональных шагов через outbox / транзакционную границу — см. `dex-skill-dotnet-async-patterns` («Mixed обязательный + опциональный шаг»).

## Semantic Types

### Дамп большого объекта через @
Плохо: `_logger.LogInformation("Request: {@Request}", httpRequest)` — весь HttpRequest в лог
Правильно: `_logger.LogInformation("Request {Method} {Path}", method, path)` — только нужные поля
Почему: JSON сериализация большого объекта = CPU + память, Seq/ELK раздувается, sensitive data может протечь

### @ на объекте с circular references
Плохо: `{@Entity}` на EF entity с навигационными свойствами — циклические ссылки
Правильно: `{@Dto}` на проекцию или примитивы: `{EntityId}`, `{EntityName}`
Почему: circular reference = StackOverflow или гигантский JSON. Serilog destructure policy не спасет от всех случаев

## Log Level

### Warning для штатной ситуации
Плохо: `_logger.LogWarning("Invalid input: {Field}", field)` — validation = нормально
Правильно: `_logger.LogDebug("Validation failed for {Field}: {Reason}", field, reason)`
Почему: Warning = что-то подозрительное, алерт-система засоряется штатными событиями

### Information для отладки
Плохо: `_logger.LogInformation("Cache miss for key {Key}", key)` — в production это спам
Правильно: `_logger.LogDebug("Cache miss for key {Key}", key)`
Почему: Information включен в production, Debug — нет. Cache miss на каждый запрос = тысячи бесполезных записей

### Error для ожидаемой ситуации
Плохо: `_logger.LogError("User {UserId} not found")` — 404 это не ошибка
Правильно: `_logger.LogWarning("User {UserId} not found", userId)`
Почему: Error -> алерт дежурному. User not found — штатная ситуация, не требует реакции

### Спам в цикле
Плохо: `foreach (var item in items) _logger.LogInformation("Processing {ItemId}", item.Id)`
Правильно: `_logger.LogInformation("Processing {Count} items for {OrderId}", items.Count, orderId)`
Почему: 10000 items = 10000 записей в Seq. Шум, за которым не видно реальных событий

### Information для трассировки флоу
Плохо: `LogInformation("Запрашиваем данные из X")` + `LogInformation("Получили N записей")` + `LogInformation("Отправляем в Y")` на каждом шаге handler'а
Правильно: Debug для шагов флоу, Information — только для завершённого бизнес-события («Order created», «Analysis completed»)
Почему: Information включён в production и идёт в алерт-системы. Шаги флоу = log flooding, ключевые бизнес-события тонут в шуме. Вопрос для self-check каждого LogInformation: «это важно оператору в 3 часа ночи в инциденте, или только разработчику при отладке?» — если второе, это Debug

### Логи начала/конца операции в helper'е как Information
Плохо: `LogInformation("Starting helper Y")` + `LogInformation("Helper Y finished")` внутри приватного метода сервиса
Правильно: Information только на границе слоя (handler / controller) для завершённой бизнес-операции, внутренние helper'ы — Debug
Почему: log-уровень задаёт границу видимости в production. Внутренние шаги — деталь реализации, они не нужны оператору. Information на каждом helper = дублирование + невозможно найти реальное событие в потоке

## Sensitive Data

### PII в логах без маскирования
Плохо: `_logger.LogInformation("User {Email} from {Phone}", email, phone)`
Правильно: логируй `UserId`, не PII. Если нужен email — маскируй: `m***@gmail.com`
Почему: GDPR/ФЗ-152, логи хранятся годами, доступ к Seq/ELK шире чем к production БД

### Log.Fatal без flush
Плохо: `Log.Fatal("DB connection lost"); Environment.Exit(1)` — буфер не сброшен
Правильно: `Log.Fatal("..."); Log.CloseAndFlush(); Environment.Exit(1)`
Почему: Serilog буферизирует запись. Без `CloseAndFlush()` последнее (самое важное!) сообщение не доходит до Seq/файла

## Scope и контекст

### Повторение контекста в каждой строке
Плохо: повторять `{JobId}` в каждой строке лога внутри background job
Правильно: `using (_logger.BeginScope(new { JobId = jobId }))` — добавляет свойство ко ВСЕМ логам в блоке
Почему: без scope — дублирование, забытый JobId в одном вызове -> невозможно связать лог с задачей в Seq

## Чек-лист

- Structured logging (не string interpolation)
- `ILogger<T>` через DI, не статический `Log`
- Sensitive data и PII — маскировать или не логировать
- Error логи содержат exception первым параметром
- Нет спама — логируем события, не итерации
- `Log.CloseAndFlush()` перед завершением процесса
- MinimumLevel.Override для Microsoft/EF — Warning
