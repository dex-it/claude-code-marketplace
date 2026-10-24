---
name: dotnet-resources
description: .NET ресурсы и память — ловушки IDisposable, утечки, аллокации. Активируется при IDisposable, using, утечка памяти, memory leak, HttpClient, SocketException, connection timeout, dispose, event unsubscribe, StringBuilder, connection pool exhausted
---

# .NET Resources — ловушки и anti-patterns

## IDisposable и утечки

### IDisposable не вызван
Плохо: `var conn = new SqlConnection(cs); conn.Open(); /* забыли Dispose */`
Правильно: `using var conn = new SqlConnection(cs);` или `await using`
Почему: connection leak, пул соединений исчерпан → `SqlException: Timeout expired`

### MemoryStream без Dispose
Плохо: `var ms = new MemoryStream(); /* используем, не диспозим */`
Правильно: `using var ms = new MemoryStream();` — особенно критично для `RecyclableMemoryStream`
Почему: `RecyclableMemoryStream` не возвращается в пул без `Dispose`, стандартный `MemoryStream` держит буфер в LOH

### StreamReader/Writer закрывает underlying stream
Плохо: `var reader = new StreamReader(stream);` → `Dispose()` закроет `stream`
Правильно: `new StreamReader(stream, leaveOpen: true)` если stream нужен после
Почему: по умолчанию wrapper владеет потоком. Двойной close → `ObjectDisposedException`

### Event handler без отписки
Плохо: `publisher.Changed += OnChanged;` без соответствующего `-=`
Правильно: отписка в `Dispose()`: `publisher.Changed -= OnChanged;`
Почему: publisher держит ссылку на subscriber → subscriber не собирается GC. Особенно опасно для static events

## HTTP и сеть

### HttpClient через new
Плохо: `using var client = new HttpClient();` в каждом запросе или методе
Правильно: `IHttpClientFactory` → `_factory.CreateClient()`
Почему: `new HttpClient()` не переиспользует TCP. `Dispose()` не закрывает сокет сразу (TIME_WAIT) → socket exhaustion под нагрузкой

## Строки и аллокации

### String concatenation в цикле
Плохо: `foreach (var item in items) result += item;` — O(n²) аллокаций
Правильно: `string.Join(...)` или `StringBuilder.Append()`
Почему: строка иммутабельна, каждая операция создаёт новый объект, GC pressure растёт квадратично

## Память и GC

### Large Object Heap — массивы 85KB+
Плохо: `new byte[100_000]` на каждый запрос → LOH, фрагментация не устраняется GC
Правильно: `ArrayPool<byte>.Shared.Rent(100_000)` + `try/finally { ArrayPool<byte>.Shared.Return(buffer) }`
Почему: LOH собирается только при Gen2 GC, фрагментация приводит к `OutOfMemoryException` при наличии свободной памяти

### ArrayPool — забыли Return
Плохо: `var buf = ArrayPool<byte>.Shared.Rent(size); /* используем, не возвращаем */`
Правильно: `try { ... } finally { ArrayPool<byte>.Shared.Return(buf); }`
Почему: пул растёт бесконечно, выделяет новые сегменты, превращается в утечку памяти

### Closure захватывает весь объект
Плохо: лямбда обращается к `this.Field` — в closure попадает весь `this`
Правильно: `var field = this.Field; Action a = () => field;` — копируй нужное в локальную переменную
Почему: объект не освобождается пока живёт лямбда/делегат, unexpected lifetime extension

## Финализаторы

### Finalizer без Dispose pattern
Плохо: `~MyClass() { resource.Free(); }` — только финализатор, без `IDisposable`
Правильно: полный Dispose pattern — `IDisposable.Dispose()` + `GC.SuppressFinalize(this)`, финализатор как fallback
Почему: объект с финализатором переживает минимум одну дополнительную GC-коллекцию, финализатор-очередь однопоточная

## DI и lifetime

### Transient IDisposable в DI
Плохо: `services.AddTransient<IMyService, MyService>()` где `MyService : IDisposable`
Правильно: Scoped или явное управление через `IServiceScopeFactory`
Почему: контейнер трекает все Transient `IDisposable` до конца scope → накопление объектов в памяти

## Чек-лист

- `IDisposable`: всегда `using` / `await using`, особенно `SqlConnection`, `HttpClient` (нет!), `Stream`
- `HttpClient`: только через `IHttpClientFactory`
- Буферы 85KB+: `ArrayPool<T>.Shared` с обязательным `Return` в `finally`
- Event handlers: отписка в `Dispose()`
- Финализатор: только как fallback при полном Dispose pattern + `GC.SuppressFinalize`
- Transient в DI: не `IDisposable`, или явный scope
