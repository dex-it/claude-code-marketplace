---
name: dotnet-validation
description: Серверная валидация входных DTO — baseline-правила полей, FluentValidation, fail-fast. Активируется при FluentValidation, AbstractValidator, validator, валидация DTO, MaximumLength, NotEmpty, IsInEnum, RuleFor, SetInheritanceValidator, 400 vs 500, decimal, DateTimeOffset, диапазон дат, nullable required
---

# Server-Side Validation — ловушки и anti-patterns

Правило базовой гигиены: **каждое поле входного DTO имеет проверяемый на ревью минимум**, а не «правило по желанию». Поле без правила — дыра, пока не доказано обратное.

## Строки

### «Голое» строковое правило без верхней границы
Плохо: `RuleFor(x => x.Name).NotEmpty()` — длина не ограничена
Правильно: `NotEmpty().MaximumLength(ShortStringMaxLength)` — и значение, и длина
Почему: строка без верхней границы раздувает payload и БД. Граница нужна даже опциональному полю: `MaximumLength(...).When(x => x.Field is not null)`

### Лимиты длины литералами
Плохо: `MaximumLength(256)` в одном валидаторе, `MaximumLength(255)` в другом, тест проверяет `300`
Правильно: именованная константа (`ShortStringMaxLength = 256`, `FreeTextMaxLength = 1024`), общая или per-service
Почему: правило и его граничный тест должны ссылаться на один источник. Разъехавшиеся литералы → правило и тест проверяют разное

## Guid

### Обязательный Guid молча принимает Guid.Empty
Плохо: `RuleFor(x => x.OwnerId)` без правила — `Guid.Empty` (default) проезжает в БД/доставку
Правильно: required → `NotEmpty()` (ловит `null` и `Guid.Empty`); опциональный → nullable + `.When(x => x.Id is not null)`
Почему: сырой `default(Guid)`, прошедший границу, — баг. `NotEmpty()` для Guid проверяет именно `!= Guid.Empty`, а не «не null»

## Enum

### Enum без IsInEnum() и [Flags] без проверки на пустоту
Плохо: `RuleFor(x => x.Status)` без `IsInEnum()` — сырой каст `(Status)99` проезжает; у `[Flags]` пустое `default` проходит, когда бизнес требует хотя бы один флаг
Правильно: всегда `IsInEnum()` (он корректно валидирует и `[Flags]`: принимает валидные комбинации, режет неопределённые биты); для обязательного непустого `[Flags]` добавить `NotEqual(default)`
Почему: без `IsInEnum()` `(Status)99` пересекает границу. С FV 8.0 `IsInEnum()` спец-обрабатывает `[Flags]` через `IsFlagsEnumDefined`, поэтому `NotEqual(None)` его не заменяет, а дополняет

## Числа

### double/float для денег и точных величин
Плохо: `decimal Price` ← `double` в DTO, либо `RuleFor(x => x.Amount)` без границ
Правильно: `decimal` для денег; `GreaterThanOrEqualTo(0)` где отрицательное бессмысленно; `InclusiveBetween(min, max)` для диапазона
Почему: `double` теряет точность на деньгах. Число без границ пропускает `int.MaxValue`, отрицательные количества, переполнение при умножении в бизнес-логике

### NaN/Infinity у double
Плохо: `RuleFor(x => x.Ratio)` (double) без проверки, когда `NaN`/`Infinity` реально достижимы — Newtonsoft.Json, `AllowNamedFloatingPointLiterals` или вычисление из других полей
Правильно: `Must(d => !double.IsNaN(d) && !double.IsInfinity(d))`
Почему: System.Text.Json по умолчанию (`Strict`) режет `NaN`/`Infinity` на десериализации (400); при Newtonsoft, разрешённых литералах или счёте в коде `double` их принимает — ломают сравнения, агрегации и обратную сериализацию

### Парсинг числа из строки без InvariantCulture
Плохо: `decimal.Parse(dto.Value)` в маппере, валидатор парсит иначе
Правильно: `CultureInfo.InvariantCulture` + явные `NumberStyles`, **те же** в валидаторе и в runtime-маппере
Почему: `"1,5"` в разных локалях = разное число. Асимметрия валидации и обработки → валидатор пропустил одно, маппер прочитал другое

## Дата и время

### DateTime вместо DateTimeOffset
Плохо: `DateTime ExpiresAt` — `Kind` неявный (`Unspecified`/`Local`)
Правильно: `DateTimeOffset` на границе API
Почему: `DateTime` без зоны даёт сдвиг при сериализации/хранении между серверами в разных TZ. `DateTimeOffset` несёт смещение явно

### Дата без sanity-границ и кросс-полевых проверок
Плохо: `from`/`to` без проверки порядка; дата рождения в будущем; `expiresAt` в прошлом
Правильно: `RuleFor(x => x.To).GreaterThan(x => x.From)`; `LessThanOrEqualTo` для верхней границы окна
Почему: открытый диапазон `from > to` или без лимита ширины → тяжёлый запрос/DoS. Будущая дата рождения — невалидные данные, прошедшие границу

## Коллекции

### Список без верхней границы и без валидации элементов
Плохо: `RuleFor(x => x.Items)` без правил — массив на 1M элементов, элементы не проверены
Правильно: `Must(c => c.Count <= N)` + `RuleForEach(x => x.Items).SetValidator(new ItemValidator())`
Почему: коллекция без лимита размера — DoS-вектор. Без `RuleForEach` элементы массива проходят границу без проверки

## Полиморфные DTO

### Незарегистрированный подтип проезжает без валидации (silent-pass)
Плохо: `SetInheritanceValidator(v => v.Add<TKnown>(...))` — забытый подтип валидируется как «всё ок»
Правильно: единый реестр листовых валидаторов (source of truth) + `.Must(IsKnownType)` с явным кодом (runtime 400) + рефлексийный тест в CI, валящий сборку при ненайденном наследнике базового запроса
Почему: `SetInheritanceValidator` видит только тип action-параметра; неизвестный подтип молчит и доходит до бизнес-логики без проверки. Два рубежа (CI + runtime) ловят забытый при добавлении подтип

### Цепочки When(x is Subtype) вместо SetInheritanceValidator
Плохо: `When(x => x is FooRequest, () => {...}).When(x => x is BarRequest, ...)`
Правильно: корневой валидатор + `SetInheritanceValidator(v => v.Add<TSub>(...))`
Почему: цепочки `When` менее декларативны, легко забыть ветку, разъезжаются с реестром подтипов

## Архитектура валидации

### Доменный конструктор как первая линия валидации
Плохо: `throw new ArgumentException` из конструктора сущности — единственная защита от невалидного DTO
Правильно: валидация DTO ловит на границе API (400); конструктор — **последняя** линия инвариантов
Почему: бросок из конструктора через AutoMapper `.ConstructUsing(...)` оборачивается в `AutoMapperMappingException` → клиент получает **500 вместо 400**. До Domain должны доходить уже корректные данные

### Ручной IValidator.Validate() в каждом action
Плохо: `var result = _validator.Validate(dto); if (!result.IsValid) return BadRequest(...)` копипастой в каждом методе
Правильно: автоматический запуск через ActionFilter (auto-validation), регистрация `IValidator<T>` в DI
Почему: ручной вызов не масштабируется, дисциплина возложена на разработчика — легко забыть в новом эндпоинте, и невалидное тело проедет границу

### Required-поле, неотличимое от default
Плохо: non-nullable `int Count` / `bool Enabled` — «не прислали» неотличимо от `0`/`false`
Правильно: если поле должно быть задано явно — nullable (`int?`) + `NotNull()`
Почему: десериализатор подставляет `default` отсутствующему non-nullable полю. «Клиент забыл поле» выглядит как «прислал 0» — валидатор ничего не ловит

### URL-поле без ограничения схемы
Плохо: `RuleFor(x => x.Callback)` (string URL) только на формат
Правильно: `Must(IsHttpOrHttps)` — разрешены только `http`/`https`
Почему: без ограничения схемы проходят `file://`, `javascript:`, `gopher://` — векторы SSRF и инъекций

### Лимит размера тела правилом валидатора
Плохо: попытка ограничить общий размер запроса внутри `AbstractValidator`
Правильно: лимит тела — конфигом сервера (`MaxRequestBodySize`/Kestrel/reverse-proxy)
Почему: валидатор работает уже **после** десериализации — огромное тело к этому моменту прочитано в память. Резать размер надо до десериализации, на уровне хоста

## Чек-лист поля DTO

- Строка: `NotEmpty()`/формат **+** `MaximumLength` (даже опциональная) — лимит именованной константой
- Required Guid: `NotEmpty()`; опциональный: nullable + `.When`
- Enum: `IsInEnum()` (валидирует и `[Flags]`); непустой `[Flags]` — дополнительно `NotEqual(default)`
- Число: границы диапазона; деньги — `decimal`; `double` — отсев `NaN`/`Infinity`
- Дата: `DateTimeOffset`, кросс-полевой порядок `from < to`, sanity-границы
- Коллекция: лимит размера + `RuleForEach`
- Полиморфизм: реестр + `.Must(IsKnownType)` + CI-тест
- Required value-type, который надо задать явно: nullable + `NotNull()`
- Валидация на границе API, не в конструкторе Domain (иначе 500 вместо 400)
