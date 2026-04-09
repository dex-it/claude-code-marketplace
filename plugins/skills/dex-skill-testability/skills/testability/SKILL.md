---
name: testability
description: Тестируемость кода — скрытые зависимости, детерминизм, моки. Активируется при сложно тестировать, hard to test, не mockable, скрытая зависимость, DateTime.Now, flaky test, sealed mock, hidden dependency, замокать, test double
---

# .NET Testability — ловушки и anti-patterns

## Время и детерминизм

### DateTime.Now — untestable
Плохо: `DateTime.Now` / `DateTimeOffset.UtcNow` напрямую в бизнес-логике
Правильно: `TimeProvider` (.NET 8) + `FakeTimeProvider` в тестах
Почему: тест зависит от реального времени → flaky на CI, нельзя проверить edge cases (DST, конец месяца)

### Guid.NewGuid() — недетерминированный assert
Плохо: `var id = Guid.NewGuid()` внутри метода → assert на результат невозможен
Правильно: инжекция `Func<Guid>` или интерфейс `IGuidProvider` через DI
Почему: каждый запуск возвращает разный ID, тест не может проверить конкретное значение

### Random.Shared — flaky тест
Плохо: `Random.Shared.Next(min, max)` внутри логики — результат непредсказуем
Правильно: инжекция seed через конструктор или обёртка `IRandomProvider`
Почему: тест недетерминирован, воспроизвести падение по seed невозможно

## Скрытые зависимости на окружение

### Environment.GetEnvironmentVariable — зависимость на хост
Плохо: `Environment.GetEnvironmentVariable("DB_HOST")` в сервисе
Правильно: `IConfiguration` через DI, в тестах `IConfiguration` с in-memory значениями
Почему: тест зависит от переменных окружения CI/локальной машины → "works on my machine"

### static ConfigHelper / AppSettings
Плохо: `ConfigHelper.GetSetting("MaxRetries")` — статический вызов в бизнес-коде
Правильно: `IOptions<RetrySettings>` через DI
Почему: невозможно замокать, скрытая зависимость, нельзя переопределить для разных тестовых сценариев

## Файловая система и сеть

### File.ReadAllText / Directory.Exists — привязка к ФС
Плохо: `File.ReadAllText(path)` напрямую в логике → тест требует реальные файлы на диске
Правильно: `System.IO.Abstractions` — `IFileSystem` + `MockFileSystem` в тестах
Почему: тесты зависят от файловой системы хоста, медленные, хрупкие при смене пути

### HttpClient без мока
Плохо: `new HttpClient()` или `_httpClient.GetAsync(url)` → тест делает реальные HTTP-запросы
Правильно: `MockHttpMessageHandler` (например, `RichardSzalay.MockHttp`) или `IHttpClientFactory` + мок хендлер
Почему: тест зависит от сети и внешнего сервиса → нестабилен, медленен, нельзя проверить error scenarios

## Структура кода

### Конструктор с побочным эффектом
Плохо: конструктор делает HTTP-вызов, читает файл, валидирует данные
Правильно: конструктор только сохраняет зависимости; логика инициализации — в отдельный метод `InitializeAsync()`
Почему: инстанцирование объекта в тесте вызывает побочный эффект — нужны реальные ресурсы даже для unit теста

### sealed класс без интерфейса
Плохо: зависимость от `sealed class ExternalService` — Moq бросит `NotSupportedException`
Правильно: выдели `IExternalService`, или оберни в `ExternalServiceWrapper : IExternalServiceWrapper`
Почему: Moq/NSubstitute не могут создать прокси для sealed класса, тест вынужден использовать реальную реализацию

### Internal класс без InternalsVisibleTo
Плохо: `internal class OrderValidator` — unit тест из другой сборки не видит класс
Правильно: `[assembly: InternalsVisibleTo("MyProject.Tests")]` в `AssemblyInfo.cs` или `.csproj`
Почему: внутренние классы с нетривиальной логикой важно тестировать напрямую, не только через public API

## Чек-лист тестируемости

- Время: `TimeProvider` + `FakeTimeProvider`, не `DateTime.Now`
- ID: инжекция `Func<Guid>` / `IGuidProvider`, не `Guid.NewGuid()` внутри
- Конфиг: `IConfiguration` / `IOptions<T>`, не `Environment.GetEnvironmentVariable`
- ФС: `IFileSystem` (System.IO.Abstractions), не `File.*` напрямую
- HTTP: `MockHttpMessageHandler`, не реальный `HttpClient`
- Конструктор: только сохранение зависимостей, без побочных эффектов
- sealed зависимости: всегда через интерфейс или wrapper
