# Ревью: Outbox-воркер рассылки уведомлений

Заявлено в MR: опрос outbox раз в полсекунды; лимит параллельных отправок и размер пачки
меняются на лету правкой appsettings, без рестарта.

## Blocker

### 1. `tests/OutboxOptionsValidatorTests.cs` (весь файл) - проект не собирается
Отдельного тестового `.csproj` в репозитории нет, `Notify.Worker.csproj` - SDK-style проект без
`<Compile Remove="tests/**" />` и без `PackageReference` на `xunit`. По умолчанию SDK-проект
компилирует все `.cs` под своим каталогом рекурсивно, значит `tests/OutboxOptionsValidatorTests.cs`
(`using Xunit;`) компилируется как часть самого `Notify.Worker.csproj`.
Чем кончится: сборка воркера падает на `CS0246` (тип/namespace `Xunit` не найден) - сервис не
собирается вообще, как есть в MR.

### 2. `Program.cs:11` - `SmtpOptions` биндится на несуществующую секцию
`builder.Services.Configure<SmtpOptions>(builder.Configuration.GetSection("Mail"));`, а во всех
`appsettings*.json` секция называется `"Smtp"` (`appsettings.json:13`, `appsettings.Production.json:11`,
`appsettings.Staging.json:9`). Секции `Mail` нет ни в одном файле.
Чем кончится: `SmtpOptions` всегда биндится в дефолтные значения (`Host=null`, `Port=0`,
`FromAddress=null`). В `SmtpMailSender.SendAsync` (`SmtpMailSender.cs:14` `MailboxAddress.Parse(o.FromAddress)`
или `SmtpMailSender.cs:20` `client.ConnectAsync(o.Host, o.Port, ...)`) - падение при первой же
отправке. Письма не уходят никогда, независимо от настоящих значений хоста/пароля в конфиге.

### 3. `ThrottleService.cs:7-8` - имя ключа не совпадает с конфигом, деление на ноль
`config.GetValue<int>("Throttle:MessagesPerMinute")`, а в конфиге ключ `"Throttle:PerMinute"`
(`appsettings.json:21`, `appsettings.Production.json:19`). Отсутствующий ключ даёт `default(int) = 0`,
следующая строка - `60_000 / perMinute`.
Чем кончится: `DivideByZeroException` на каждый вызов `WaitAsync` для каждого сообщения -
`sender.SendAsync` (`OutboxWorker.cs:64`) не вызывается вовсе, письмо не отправляется никогда.
Дополнительно опции читаются мимо options-пайплайна (`IConfiguration.GetValue` напрямую, без
класса `ThrottleOptions` и без `ValidateOnStart`), поэтому даже почини имя ключа - `PerMinute: 0`
всё равно не отловится на старте, упадёт в рантайме.

### 4. `OutboxWorker.cs:52-55` вместе с находкой 3 - сообщения помечаются отправленными до отправки, ретраи не работают никогда
`m.SentAt = now;` (строка 53) выставляется и сохраняется (`SaveChangesAsync`, строка 55) для всей
пачки ДО вызова `sender.SendAsync` (строка 64). Фильтр выборки - `m.SentAt == null && m.Attempts < o.MaxRetries`
(строка 44). Как только сообщение заклеймлено, оно навсегда выпадает из следующих опросов, даже
если реальная отправка упала (см. находку 3 - она падает гарантированно).
Чем кончится: воркер вычитывает outbox, помечает все сообщения как отправленные, но ни одно письмо
фактически не уходит (падает на throttle до вызова MailKit); `Attempts`/`MaxRetries` - мёртвый код,
повторной попытки не будет никогда. Тихая полная потеря уведомлений без единой ошибки уровня выше WARN.

### 5. `OutboxWorker.cs:33` - `PollInterval` читается как секунды, а не как заявленные 0.5 сек
`Task.Delay(TimeSpan.FromSeconds(o.PollInterval), ct)`, конфиг `"Outbox": { "PollInterval": 500 }`
(`appsettings.json:6`). Имя настройки без единицы (см. чек-лист "единица измерения в имени") -
код трактует как секунды.
Чем кончится: опрос outbox раз в 500 секунд (~8 минут 20 секунд) вместо заявленных в MR "раз в
полсекунды" - расхождение с описанием MR на ~1000x. Ключевое требование MR не выполнено.

### 6. `Program.cs` (весь файл) - `IOptions<OutboxOptions>`, а не `IOptionsMonitor`: конфиг не меняется на лету
`OutboxWorker` (singleton `BackgroundService`, зарегистрирован `AddHostedService<OutboxWorker>()`
в `Program.cs:15`) принимает `IOptions<OutboxOptions> options` (`OutboxWorker.cs:11`) и читает
`options.Value` (`OutboxWorker.cs:22`). `IOptions<T>` биндится один раз на весь lifetime процесса
и не видит правки `appsettings.json` после старта.
Чем кончится: `MaxInFlight` (лимит параллельных отправок) и `MinBatchSize`/`MaxBatchSize` (размер
пачки) - именно то, что MR прямо требует менять на лету без рестарта - на практике требуют
рестарта процесса. Нужен `IOptionsMonitor<OutboxOptions>` (`.CurrentValue` вместо `.Value`); остальной
код уже перечитывает `o` на каждой итерации (`OutboxWorker.cs:22`), так что при замене типа это
заработает без прочих изменений.

### 7. `Program.cs` (весь файл) / `Options/OutboxOptionsValidator.cs` - валидатор написан, но не зарегистрирован
`OutboxOptionsValidator` реализует `IValidateOptions<OutboxOptions>` и покрыт зелёными тестами
(`tests/OutboxOptionsValidatorTests.cs`), но в `Program.cs` нет ни `TryAddEnumerable<IValidateOptions<OutboxOptions>, OutboxOptionsValidator>`,
ни `.AddOptions<OutboxOptions>().ValidateOnStart()`. Только `Configure<OutboxOptions>(...)`
(`Program.cs:10`).
Чем кончится: правило никогда не исполняется - ни на старте, ни при первом обращении. Битый
конфиг (например, находка 8 ниже) проходит в продакшен без единого сигнала; зелёные тесты
валидатора создают ложное чувство защищённости.

### 8. `appsettings.Production.json:3,16` - реальные секреты в закоммиченном файле
`"Password": "Kx7!pQ2vR9wz"` (пароль БД, строка 3) и `"Password": "rl_live_9f3a1c77e2b04d6d"`
(пароль SMTP-релея, строка 16) - в открытом виде в файле, идущем в репозиторий. `appsettings.Staging.json:3`
рядом показывает, что команда знает правильный паттерн (`"${NOTIFY_DB_PASSWORD}"`), но для
Production он не применён.
Чем кончится: настоящие продовые credentials навсегда в истории git, доступны любому с доступом к
репозиторию (или после утечки) даже после последующей ротации и удаления из HEAD.

## Major

### 9. `Options/OutboxOptionsValidator.cs:9-14` - валидатор не проверяет `MinBatchSize` и инвариант `MinBatchSize <= MaxBatchSize`
Проверяются только `MaxBatchSize > 0`, `MaxInFlight > 0`, `MaxRetries >= 0`, `LockTimeout > 0`.
`MinBatchSize` не проверяется вовсе - ни `> 0`, ни соотношение с `MaxBatchSize`, от которого
зависит ветка адаптивного батчинга (`OutboxWorker.cs:25`).
Чем кончится: даже после регистрации валидатора (находка 7) конфиг вида `MinBatchSize > MaxBatchSize`
(находка 10) пройдёт валидацию и старт как валидный.

### 10. `appsettings.Production.json:6-7` - `MinBatchSize` (200) больше `MaxBatchSize` (100)
`OutboxWorker.cs:25`: `if (o.MinBatchSize < o.MaxBatchSize)` - условие ложно, вся ветка
адаптивного батчинга (сжатие/рост размера пачки под нагрузкой) тихо не выполняется, `_batchSize`
замирает на исходном `MaxBatchSize` навсегда. Ни ошибки, ни лога.
Чем кончится: в Production фича адаптивного батчинга не работает никогда, и это не видно ни по
одному сигналу - классический тихий `if` вместо валидации кросс-полевого инварианта.

### 11. `appsettings.Staging.json:6` vs `appsettings.Production.json:8` - Staging агрессивнее Production без объяснения
`Outbox.MaxInFlight`: Staging = 20, Production = 5 - в 4 раза выше параллелизм отправки на
staging, без комментария/обоснования в файле.
Чем кончится: Staging не воспроизводит поведение Production под нагрузкой (пул соединений SMTP,
throttle, конкуренция за строки в БД при `SaveChangesAsync`) - проблемы, которые проявились бы
при малом `MaxInFlight` в проде, на staging не поймать, и наоборот.

## Minor

### 12. `Options/SmtpOptions.cs:5,7` - non-nullable `string` без `required` при `Nullable enable`
`Host` и `FromAddress` объявлены как `string` без `required` и без дефолта, при этом проект собран
с `<Nullable>enable</Nullable>` (`Notify.Worker.csproj:4`). Это только предупреждение `CS8618`,
никак не блокирующее сборку (`TreatWarningsAsErrors` не включён).
Чем кончится: компилятор не заставляет заполнить оба свойства - именно это позволило находке 2
(биндинг на несуществующую секцию `Mail`) остаться незамеченной до рантайма. `required` на обоих
свойствах превратил бы её в ошибку компиляции.

### 13. `appsettings.Production.json:8-9` / `appsettings.Staging.json:7` - продублированные дефолтные значения
`MaxInFlight: 5` и `MaxRetries: 5` в Production, `MaxRetries: 5` в Staging - буквально совпадают со
значениями из `appsettings.json:9-10` (базовый дефолт), не являясь реальным отклонением среды.
Чем кончится: непонятно, какие параметры реально переопределены для среды (из троих полей Outbox в
Production только секция целиком выглядит как override, а по факту отклонение - только `MinBatchSize`);
при будущей правке дефолта в базовом файле эти строки разъедутся и будут держать старое значение
незаметно.

## Итог

Blocker: 8
Major: 3
Minor: 2
