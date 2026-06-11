---
name: dotnet-config-hygiene
description: .NET config hygiene — appsettings, IOptions, env-настройки, валидация. Активируется при appsettings, IOptions, IOptionsMonitor, IOptionsSnapshot, BindConfiguration, AddOptions, ValidateOnStart, окружения, staging, production, options pattern
---

# .NET Config Hygiene — ловушки и anti-patterns

## Окружения

### Staging агрессивнее Production без объяснения
Плохо: appsettings.Staging.json: { "Concurrency": 20 }, appsettings.Production.json: { "Concurrency": 5 }
Правильно: staging ≤ prod по нагрузочным параметрам; если выше — добавь комментарий с причиной в README/appsettings
Почему: staging с более высоким параллелизмом не воспроизводит prod-поведение. Ошибки под нагрузкой не обнаруживаются. Паттерн «staging > prod» почти всегда — баг, не фича

### Имя настройки без единицы провоцирует unit confusion
Плохо: { "Interval": 500 } — код читает как секунды, автор задумывал миллисекунды → пауза в 100× длиннее
Правильно: единица в имени — { "IntervalMs": 500 }; код биндит свойство `IntervalMs` и не угадывает порядок величины
Почему: безымянное число в timing-настройке каждая сторона трактует по-своему (ms/s/min). На staging пауза в 8 минут вместо 0.5 сек незаметна, на prod — зависший процесс, пропущенные таймауты

## IOptions

### Нет валидации конфигурации при старте
Плохо: var size = config.GetValue<int>("BatchSize"); // 0 или -1 = DivisionByZero где-то в runtime
Правильно: services.AddOptions<Options>().BindConfiguration("Batch").ValidateDataAnnotations().ValidateOnStart();
Почему: некорректная конфигурация обнаруживается при первом использовании под нагрузкой, а не при старте. ValidateOnStart() бросает при запуске — видно сразу в деплое, а не через час в production

### IOptions для конфигурации с reload on change
Плохо: внедряют `IOptions<T>` и ждут, что значение обновится после правки appsettings — `IOptions` кэшируется на весь lifetime приложения
Правильно: `IOptionsSnapshot<T>` для пересчёта на каждый scope (запрос), `IOptionsMonitor<T>` для singleton с подпиской на изменения; `IOptions<T>` — только для неизменяемой за время работы конфигурации
Почему: `IOptions<T>` — singleton, биндится один раз при первом обращении. Reload-on-change в нём не виден; разработчик считает фичу нерабочей и правит её «вслепую»

### Связанные поля Options без взаимной валидации молча нарушают функцию
Плохо: два поля (`NegativeExpiration`, `Expiration`) задаются независимо — при нарушении `NegativeExpiration >= Expiration` зависимая ветка кода тихо не выполняется, исключения нет
Правильно: проверить инвариант в `init`-сеттере: `ArgumentOutOfRangeException.ThrowIfGreaterThanOrEqual(value, Expiration, nameof(NegativeExpiration))` — некорректная конфигурация падает при создании объекта
Почему: `ValidateDataAnnotations().ValidateOnStart()` проверяет каждое поле независимо; кросс-полевой инвариант без явной проверки пропускает невалидное состояние — фича «включена», но ведёт себя иначе

### Non-nullable string в Options без `required` — NRE при первом обращении
Плохо: `public string CacheKey { get; init; }` — при `new Options()` без явного значения поле равно `null`, несмотря на non-nullable тип; `NullReferenceException` только в runtime
Правильно: `public required string CacheKey { get; init; }` — компилятор запрещает конструирование без явного значения; `[Required]` + `ValidateOnStart()` — дополнительный рубеж при bind-е из appsettings
Почему: nullable-аннотации — предупреждение компилятора, не гарантия; `new()` молча оставляет reference-тип `null`; без `required` баг отсутствует до первого обращения под нагрузкой

## Читаемость

### Единица измерения не отражена в имени настройки
Плохо: "Timeout": 30, "Interval": 500 — секунды? миллисекунды? минуты?
Правильно: "TimeoutSeconds": 30, "IntervalMs": 500 — или ISO 8601: "Timeout": "00:00:30"
Почему: без единицы в имени — следующий разработчик или другая среда ставит неверный порядок величины. Ошибка обнаруживается только в runtime по симптомам, не по коду

### Значение по умолчанию явно повторяется в каждом env-файле
Плохо: appsettings.json + appsettings.Staging.json + appsettings.Production.json — у всех "BatchSize": 100
Правильно: "BatchSize": 100 только в appsettings.json; env-файлы содержат только отклонения от дефолта
Почему: дублирование скрывает реальные отклонения между средами. При изменении дефолта — не все env-файлы обновляются → расхождения, которые тяжело поймать

## Секреты

### Секреты в appsettings.json в репозитории
Плохо: connection string с паролем, API-ключ, токен прямо в `appsettings.json` / `appsettings.Production.json`, закоммиченном в репозиторий
Правильно: в `appsettings.json` — только плейсхолдер / имя источника; реальные значения через user-secrets (dev), переменные окружения или secret store (prod). Конфигурация склеивается из источников провайдерами `AddUserSecrets()` / `AddEnvironmentVariables()`
Почему: закоммиченный секрет остаётся в истории git навсегда, даже после удаления из HEAD, и утекает вместе с клоном репозитория. Новый проект — типичный момент, когда секрет «временно» прописывают в файл и забывают вынести
> Детали угроз и ротации — `dex-skill-owasp-security`

## Чек-лист

- Staging ≤ prod по нагрузочным параметрам (concurrency, batch size, timeout)
- Если staging намеренно отличается — задокументировано явно
- Единицы измерения включены в имя свойства (TimeoutSeconds, IntervalMs) или ISO 8601
- ValidateDataAnnotations + ValidateOnStart для критичных Options-классов
- env-специфичные файлы содержат только отклонения, не дефолтные значения
