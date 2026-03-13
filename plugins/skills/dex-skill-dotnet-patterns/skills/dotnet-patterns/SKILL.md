---
name: dotnet-patterns
description: Принципы проектирования и паттерны в .NET. Активируется при упоминании pattern, SOLID, DI, dependency injection, design pattern, DRY, KISS, YAGNI
---

# .NET Patterns — ловушки и anti-patterns

## SOLID нарушения

### God-class с 10+ зависимостями
Плохо: конструктор с 10 параметрами — `OrderService(IRepo, IEmail, IInvoice, IPayment, ICache, ILogger, ...)`
Правильно: декомпозиция на несколько сервисов по ответственности, или MediatR/Pipeline
Почему: нарушение SRP. Класс меняется по 10 причинам, тесты требуют 10 моков, невозможно понять что класс делает

### switch на тип вместо полиморфизма
Плохо: `if (order.Type == "VIP") ... else if (order.Type == "Employee") ...` — при новом типе правим метод
Правильно: `IDiscountStrategy` с реализациями `VipDiscount`, `EmployeeDiscount`, DI resolve по типу
Почему: нарушение OCP. Каждый новый тип = правка существующего кода, риск сломать работающее

### throw NotSupportedException в наследнике
Плохо: `ReadOnlyRepository : Repository { override Save() => throw new NotSupportedException(); }`
Правильно: разделить интерфейсы: `IReadRepository<T>` и `IWriteRepository<T>`
Почему: нарушение LSP. Код принимает `Repository` и ожидает что `Save` работает. Runtime exception вместо compile-time ошибки

## Dependency Injection

### new Service() вместо DI
Плохо: `private readonly EmailService _email = new EmailService()` — прямое создание
Правильно: `public OrderService(IEmailService email)` — инжекция через конструктор
Почему: привязка к конкретной реализации, невозможно замокать в тестах, невозможно заменить реализацию без перекомпиляции

### Captive Dependency (Scoped в Singleton)
Плохо: Singleton сервис инжектит Scoped `DbContext` — `services.AddSingleton<MyService>()` + `MyService(AppDbContext ctx)`
Правильно: используй `IServiceScopeFactory` и создавай scope вручную, или сделай `MyService` Scoped
Почему: DbContext захватывается навечно в singleton, change tracker растёт бесконечно, данные становятся stale. .NET не предупреждает по умолчанию (включи `ValidateScopes` в Development)

### Service Locator
Плохо: `var service = serviceProvider.GetService<IOrderService>()` внутри бизнес-кода
Правильно: инжекция через конструктор — `public MyClass(IOrderService orderService)`
Почему: зависимости скрыты, невидимы из конструктора. Тесты ломаются в runtime, не в compile-time. Нарушает принцип explicit dependencies

### Регистрация конкретного класса вместо интерфейса
Плохо: `services.AddScoped<OrderService>()` — привязка к конкретному типу
Правильно: `services.AddScoped<IOrderService, OrderService>()`
Почему: невозможно заменить реализацию, декорировать, или замокать. При тестировании приходится создавать реальный сервис со всеми зависимостями

## async/await

### async void
Плохо: `async void HandleClick()` — исключение не перехватываемо
Правильно: `async Task HandleClick()` — исключение можно await'нуть и поймать
Почему: async void проглатывает исключения (crashит процесс в ASP.NET) и не может быть await'нут. Единственное допустимое использование — event handlers в WPF/WinForms

### Забытый CancellationToken
Плохо: `public async Task<Order> GetOrderAsync(int id)` — без CancellationToken
Правильно: `public async Task<Order> GetOrderAsync(int id, CancellationToken ct)` — пробрасывай во все async вызовы
Почему: клиент отменил HTTP запрос (ушёл со страницы), но сервер продолжает тяжёлую операцию. Без CancellationToken = потраченные ресурсы на никому не нужный результат

### .Result / .Wait() — deadlock
Плохо: `var result = GetOrderAsync(id).Result` — синхронная блокировка async метода
Правильно: `var result = await GetOrderAsync(id)` — async всю дорогу
Почему: в ASP.NET (до .NET 6 с SynchronizationContext) — гарантированный deadlock. В .NET 6+ — thread pool starvation под нагрузкой

## Ресурсы и память

### IDisposable не вызван
Плохо: `var connection = new SqlConnection(cs); connection.Open(); /* забыли Dispose */`
Правильно: `using var connection = new SqlConnection(cs);` или `await using`
Почему: connection leak, пул соединений исчерпан → `SqlException: Timeout expired. The timeout period elapsed prior to obtaining a connection from the pool`

### String concatenation в цикле
Плохо: `foreach (var item in items) result += item.Name + ", ";` — O(n²) аллокаций
Правильно: `string.Join(", ", items.Select(i => i.Name))` или `StringBuilder`
Почему: строка иммутабельна, каждая конкатенация создаёт новый объект. 10000 элементов = 10000 аллокаций, GC pressure, медленно

### HttpClient через new
Плохо: `using var client = new HttpClient(); await client.GetAsync(url);` — в каждом запросе
Правильно: `IHttpClientFactory` через DI → `_clientFactory.CreateClient()`
Почему: `new HttpClient()` не переиспользует TCP соединения → socket exhaustion. `Dispose()` не закрывает сокет сразу (TIME_WAIT). Под нагрузкой — `SocketException`

## Тестируемость

### DateTime.Now — untestable
Плохо: `if (order.CreatedAt < DateTime.Now.AddDays(-30))` — нельзя протестировать
Правильно: `TimeProvider` (.NET 8) или `IClock` интерфейс — `if (order.CreatedAt < _timeProvider.GetUtcNow().AddDays(-30))`
Почему: тест зависит от текущего времени, flaky на CI, невозможно проверить edge cases (конец месяца, DST, високосный год)

### static зависимости
Плохо: `ConfigHelper.GetSetting("MaxRetries")` — статический вызов в бизнес-логике
Правильно: `IOptions<RetrySettings>` через DI
Почему: невозможно замокать в тестах, скрытая зависимость, нельзя переопределить для разных environments

## Over-engineering

### Признаки
- Интерфейс с одной реализацией, которая никогда не поменяется
- Generic класс, используемый для одного типа
- Factory, которая создаёт один объект
- Middleware/filter для одного endpoint
- "Extensible" архитектура для MVP

### DRY ради DRY
Плохо: `ProcessEntity<T>(T entity)` с 200 строками `if (entity is Order) ... else if (entity is Invoice) ...`
Правильно: три отдельных метода — три похожие строки лучше плохой абстракции
Почему: ложная абстракция хуже дублирования. Изменение одного кейса ломает другие

### Result Pattern для инфраструктурных ошибок
Плохо: `return Result.Failure("Database connection failed")` — ловим инфраструктурный сбой в Result
Правильно: Result для бизнес-ошибок (not found, validation), exceptions для инфраструктуры (DB down, timeout)
Почему: инфраструктурные ошибки неожиданны и требуют другой обработки (retry, circuit breaker). Result делает их "тихими"

## Чек-лист

- Конструктор: до 3-5 зависимостей (больше = нарушение SRP)
- DI: интерфейсы, не конкретные классы, не new(), не Service Locator
- async: Task (не void), CancellationToken, нет .Result/.Wait()
- IDisposable: using/await using, HttpClient через IHttpClientFactory
- Тестируемость: TimeProvider, IOptions, нет static зависимостей
- Нет кода "на будущее" (YAGNI)
