---
name: dotnet-config-hygiene
description: Конфигурация .NET — гигиена appsettings. Активируется при appsettings, IOptions, configuration, binding, environment, staging, production, timeout, batch, interval, ValidateOnStart, ValidateDataAnnotations, appsettings.json, appsettings.Production
---

# .NET Config Hygiene — ловушки и anti-patterns

## Окружения

### Staging агрессивнее Production без объяснения
Плохо: appsettings.Staging.json: { "Concurrency": 20 }, appsettings.Production.json: { "Concurrency": 5 }
Правильно: staging ≤ prod по нагрузочным параметрам; если выше — добавь комментарий с причиной в README/appsettings
Почему: staging с более высоким параллелизмом не воспроизводит prod-поведение. Ошибки под нагрузкой не обнаруживаются. Паттерн «staging > prod» почти всегда — баг, не фича

### Явно ошибочные значения в env-специфичных настройках
Плохо: appsettings.Staging.json: { "IntervalSeconds": 500 } // 8+ минут ожидания на staging
Правильно: проверь единицы: 500 ms или 500 s? Если 0.5s — IntervalMs = 500, если 5s — IntervalSeconds = 5
Почему: большие числа в timing-настройках часто = unit confusion (ms vs s vs min). На staging последствия незаметны, на prod — зависший процесс, пропущенные таймауты

## Валидация

### Нет валидации конфигурации при старте
Плохо: var size = config.GetValue<int>("BatchSize"); // 0 или -1 = DivisionByZero где-то в runtime
Правильно: services.AddOptions<Options>().BindConfiguration("Batch").ValidateDataAnnotations().ValidateOnStart();
Почему: некорректная конфигурация обнаруживается при первом использовании под нагрузкой, а не при старте. ValidateOnStart() бросает при запуске — видно сразу в деплое, а не через час в production

## Читаемость

### Единица измерения не отражена в имени настройки
Плохо: "Timeout": 30, "Interval": 500 — секунды? миллисекунды? минуты?
Правильно: "TimeoutSeconds": 30, "IntervalMs": 500 — или ISO 8601: "Timeout": "00:00:30"
Почему: без единицы в имени — следующий разработчик или другая среда ставит неверный порядок величины. Ошибка обнаруживается только в runtime по симптомам, не по коду

### Значение по умолчанию явно повторяется в каждом env-файле
Плохо: appsettings.json + appsettings.Staging.json + appsettings.Production.json — у всех "BatchSize": 100
Правильно: "BatchSize": 100 только в appsettings.json; env-файлы содержат только отклонения от дефолта
Почему: дублирование скрывает реальные отклонения между средами. При изменении дефолта — не все env-файлы обновляются → расхождения, которые тяжело поймать

## Чек-лист

- Staging ≤ prod по нагрузочным параметрам (concurrency, batch size, timeout)
- Если staging намеренно отличается — задокументировано явно
- Единицы измерения включены в имя свойства (TimeoutSeconds, IntervalMs) или ISO 8601
- ValidateDataAnnotations + ValidateOnStart для критичных Options-классов
- env-специфичные файлы содержат только отклонения, не дефолтные значения
