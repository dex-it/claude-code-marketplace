---
name: dotnet-di
description: .NET DI — ловушки регистрации, lifetime, Service Locator. Активируется при dependency injection, регистрация сервиса, AddScoped, AddSingleton, configure services, captive dependency, scoped в singleton, IServiceProvider, lifetime, DI, startup
---

# .NET DI — ловушки и anti-patterns

## Lifetime

### Captive Dependency (Scoped в Singleton)
Плохо: `AddSingleton<MyService>()` + `MyService(AppDbContext ctx)` — Scoped захвачен навсегда
Правильно: `IServiceScopeFactory` + ручной scope, или перевести `MyService` в Scoped
Почему: DbContext живёт всё время приложения — change tracker растёт, данные stalе. `ValidateScopes` ловит только в Development по умолчанию

### Transient IDisposable — memory leak
Плохо: `AddTransient<IHeavyService, HeavyService>()` где `HeavyService : IDisposable` — часто resolve в scope
Правильно: фабрика `Func<IHeavyService>` + ручной `using`, или Singleton если stateless
Почему: контейнер трекает все Transient IDisposable до конца scope и освобождает их только при его завершении

### AddSingleton с готовым экземпляром — нет Dispose
Плохо: `services.AddSingleton<INotifier>(new EmailNotifier())`
Правильно: `services.AddSingleton<INotifier, EmailNotifier>()` или фабричная лямбда
Почему: контейнер не управляет lifecycle вручную созданного экземпляра — `Dispose()` не будет вызван при завершении

## Регистрация

### Конкретный класс вместо интерфейса
Плохо: `services.AddScoped<OrderService>()`
Правильно: `services.AddScoped<IOrderService, OrderService>()`
Почему: невозможно замокать в тестах, декорировать через Scrutor, или заменить реализацию без изменения кода

### new Service() вместо DI
Плохо: `private readonly EmailService _email = new EmailService()`
Правильно: инжекция через конструктор `public OrderService(IEmailService email)`
Почему: жёсткая привязка к реализации, невозможно замокать, нет управления lifecycle контейнером

### TryAdd vs Add — двойная регистрация
Плохо: `services.AddScoped<ICache, RedisCache>()` в библиотечном коде — перезаписывает регистрацию хоста
Правильно: `services.TryAddScoped<ICache, RedisCache>()` — пропускает если уже зарегистрировано
Почему: `Add*` всегда добавляет (последняя побеждает при resolve одного), `TryAdd*` уважает явные регистрации потребителя

### Open generics — constraint mismatch в runtime
Плохо: `services.AddScoped(typeof(IRepo<>), typeof(Repo<>))` — несовместимые generic constraints не видны компилятору
Правильно: проверять constraints вручную; добавить интеграционный тест на `BuildServiceProvider()`
Почему: контейнер не валидирует generic constraints при регистрации — exception только при первом resolve в runtime

## Service Locator

### IServiceProvider в бизнес-коде
Плохо: `_serviceProvider.GetRequiredService<IOrderService>()` внутри бизнес-логики
Правильно: инжекция через конструктор
Почему: зависимости скрыты, невидимы из конструктора. Тесты требуют настройки полного контейнера вместо одного мока. Исключение: фабрики, middleware, динамический resolve по типу

## Scrutor / Decorator

### Decorate — неверный порядок
Плохо: `services.Decorate<ICache, LoggingCache>()` до `services.AddScoped<ICache, RedisCache>()`
Правильно: сначала `Add*`, затем `Decorate`
Почему: `Decorate` ищет существующую регистрацию — если её нет, выбрасывает `InvalidOperationException`

## Keyed Services

### Магическая строка вместо константы
Плохо: `[FromKeyedServices("primary")]` + `services.AddKeyedScoped<ICache, RedisCache>("primray")` — опечатка
Правильно: константа `const string PrimaryCache = "primary"`, используется в обоих местах
Почему: опечатка в ключе = `InvalidOperationException` в runtime, не compile-time ошибка

## Валидация

### ValidateScopes выключен в Production
Плохо: captive dependency не обнаруживается на prod — `ValidateScopes` false по умолчанию вне Development
Правильно: включить `ValidateOnBuild: true` и `ValidateScopes: true` на staging или в интеграционных тестах
Почему: `UseDefaultServiceProvider(o => { o.ValidateScopes = true; o.ValidateOnBuild = true; })` выбрасывает при старте, не в runtime

## Чек-лист

- Lifetime: Singleton не захватывает Scoped/Transient зависимости
- Transient IDisposable: фабрика + ручной using, или перевод в Singleton
- Регистрация: интерфейс → реализация, не конкретный класс напрямую
- Библиотечный код: `TryAdd*`, не `Add*`, чтобы не перебивать регистрации хоста
- Open generics: интеграционный тест на `BuildServiceProvider()`
- Keyed services: ключи в константах, не литеральные строки
- Валидация: `ValidateScopes + ValidateOnBuild` в тестах и staging
