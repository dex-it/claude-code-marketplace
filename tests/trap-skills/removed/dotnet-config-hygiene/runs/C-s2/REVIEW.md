# Review: Notify.Worker (Outbox-воркер рассылки уведомлений)

MR-описание заявляет: опрос outbox раз в 0.5 сек; лимит параллельных отправок и размер пачки
меняются на лету правкой appsettings, без рестарта. Ниже - находки по факту кода.

## Blocker

### 1. Smtp-опции биндятся на несуществующую секцию конфига
`Program.cs:11`
```
builder.Services.Configure<SmtpOptions>(builder.Configuration.GetSection("Mail"));
```
Секция в конфиге называется `Smtp` (`appsettings.json:13`, `appsettings.Production.json:11`,
`appsettings.Staging.json:9`), секции `Mail` нет ни в одном файле. `GetSection("Mail")` вернёт
пустую секцию, `SmtpOptions` забиндится в дефолты (`Host`/`FromAddress` = null, `Port` = 0).
Чем кончится: `SmtpMailSender.cs:14` (`MailboxAddress.Parse(o.FromAddress)`) или
`SmtpMailSender.cs:20` (`client.ConnectAsync(o.Host, o.Port, ...)`) бросают
`ArgumentNullException`/`SocketException` на каждой попытке отправки - воркер не отправит ни
одного письма ни в одном окружении, при этом сконфигурированные Smtp-настройки выглядят валидно.

### 2. Валидатор Options написан, покрыт тестом, но не зарегистрирован в DI
`Options/OutboxOptionsValidator.cs` (весь файл) + `tests/OutboxOptionsValidatorTests.cs`
(зелёный) против `Program.cs:10` - там только `Configure<OutboxOptions>(...)`, нигде нет
`services.AddSingleton<IValidateOptions<OutboxOptions>, OutboxOptionsValidator>()` и нет
`.ValidateOnStart()`. Чем кончится: класс валидатора никогда не вызывается рантаймом; команда
считает конфиг защищённым (тесты зелёные), а по факту любое невалидное значение (см. находку 3)
беспрепятственно доезжает до продакшна без единого предупреждения при деплое.

### 3. MinBatchSize > MaxBatchSize в Production - инвариант нарушен и не отловлен
`appsettings.Production.json:6-7`: `MinBatchSize: 200`, `MaxBatchSize: 100` (база
`appsettings.json:7-8`: 20/100). Инвариант проверяется тихим `if` в `OutboxWorker.cs:25`
(`if (o.MinBatchSize < o.MaxBatchSize)`), а не валидацией. Чем кончится: условие в Production
всегда `false` -> адаптивное изменение размера пачки (строки 26-30) молча не работает, размер
пачки навсегда зависает на стартовом `MaxBatchSize` (100), без ошибки, лога или деплой-фейла;
из-за находки 2 это никто не увидит на старте.

### 4. PollInterval трактуется как секунды вместо миллисекунд - интервал опроса ~8 минут вместо 0.5 сек
`Options/OutboxOptions.cs:5` (`PollInterval` без единицы в имени) + `OutboxWorker.cs:33`:
```
await Task.Delay(TimeSpan.FromSeconds(o.PollInterval), ct);
```
`appsettings.json:6` задаёт `PollInterval: 500`, что по описанию MR означает «раз в полсекунды»
(500 мс). Код читает то же число как секунды. Чем кончится: реальный интервал опроса outbox -
500 секунд (~8.3 минуты) вместо заявленных 0.5 секунды - воркер рассылки не соответствует
основному требованию MR примерно в 1000 раз по задержке.

### 5. Throttle читает несуществующий ключ конфига -> DivideByZeroException на каждой отправке
`ThrottleService.cs:7`: `config.GetValue<int>("Throttle:MessagesPerMinute")`. Во всех трёх
appsettings-файлах ключ называется `Throttle:PerMinute` (`appsettings.json:21`,
`appsettings.Production.json:19`; в Staging секции `Throttle` нет вовсе, наследуется база).
`GetValue<int>` на отсутствующий ключ возвращает `0`. Чем кончится: `ThrottleService.cs:8`
(`60_000 / perMinute`) - деление на 0 - `DivideByZeroException` при первом же вызове
`throttle.WaitAsync` (`OutboxWorker.cs:63`), то есть при попытке отправить первое письмо. Воркер
не проработает дольше одной итерации с непустым outbox.

### 6. Реальные секреты закоммичены в appsettings.Production.json
`appsettings.Production.json:3` - пароль БД в открытом виде (`Kx7!pQ2vR9wz`);
`appsettings.Production.json:16` - ключ SMTP-релея в открытом виде (`rl_live_9f3a1c77e2b04d6d`).
Оба выглядят как боевые значения, не плейсхолдеры (сравни со `Staging`, где пароль БД -
`${NOTIFY_DB_PASSWORD}` через env). Чем кончится: секреты навсегда остаются в истории git даже
после удаления из HEAD и утекают с любым клоном репозитория; ключ релея и пароль БД требуют
немедленной ротации независимо от исхода ревью.

### 7. Сообщение помечается отправленным до попытки отправки - retry никогда не срабатывает
`OutboxWorker.cs:50-55`:
```
foreach (var m in batch)
{
    m.LockedUntil = now + o.LockTimeout;
    m.SentAt = now;
}
await db.SaveChangesAsync(ct);
```
`SentAt = now` выставляется и сохраняется в БД ДО попытки отправки (строки 58-76). В `catch`
при неудаче (строка 68) инкрементируется только `Attempts`, `SentAt` не сбрасывается. Чем
кончится: выборка следующего цикла (`OutboxWorker.cs:44`,
`m.SentAt == null && m.Attempts < o.MaxRetries`) навсегда исключает это сообщение - оно уже
"отправлено" с точки зрения БД. `MaxRetries` (`appsettings.json:10`) становится мёртвой
настройкой: письмо, упавшее по любой причине (таймаут SMTP, невалидный адрес), теряется молча,
без единой повторной попытки, независимо от значения `MaxRetries`.

### 8. OutboxOptions читается через IOptions - изменения appsettings на лету не подхватываются
`OutboxWorker.cs:11` - конструктор берёт `IOptions<OutboxOptions> options`, не
`IOptionsMonitor<OutboxOptions>`. `OutboxWorker` зарегистрирован как `AddHostedService`
(singleton, `Program.cs:15`). `IOptions<T>.Value` биндится один раз и кэшируется на весь
lifetime процесса; `options.Value` на строке 22 каждую итерацию возвращает тот же закэшированный
объект. Чем кончится: правка `Outbox:MaxInFlight` или `Outbox:MaxBatchSize` в appsettings.json
без рестарта процесса не действует - прямое нарушение требования из описания MR («лимит
параллельных отправок и размер пачки должны меняться на лету правкой appsettings, без
рестарта»). Нужен `IOptionsMonitor<OutboxOptions>` с чтением `.CurrentValue` на каждой
итерации.

## Major

### 9. Staging агрессивнее Production без объяснения
`appsettings.Staging.json:6`: `MaxInFlight: 20` против Production
(`appsettings.Production.json:8`, значение наследуется из базы `appsettings.json:9`):
`MaxInFlight: 5`. Staging параллелит отправку в 4 раза сильнее прода, комментария или пояснения
нет ни в файле, ни в README рядом. Чем кончится: staging не воспроизводит прод-профиль нагрузки
на SMTP-relay/DB-пул; проблемы, которые всплывут только при высоком параллелизме (рейт-лимит
релея, эксхауст пула соединений EF Core), не будут пойманы на staging и проявятся впервые в
Production.

### 10. Валидатор не проверяет MinBatchSize вовсе
`Options/OutboxOptionsValidator.cs:10-13` - проверяются `MaxBatchSize`, `MaxInFlight`,
`MaxRetries`, `LockTimeout`; `MinBatchSize` не участвует ни в одной проверке (ни `>= 0`, ни
`MinBatchSize < MaxBatchSize`). Чем кончится: даже после исправления находки 2 (регистрация
валидатора) конфиг из находки 3 (`MinBatchSize: 200 > MaxBatchSize: 100`) пройдёт валидацию
на старте без единой ошибки - дырка в самом правиле, а не только в его подключении.

### 11. ThrottleService читает конфиг мимо Options-пайплайна
`ThrottleService.cs:3-9` - вместо типизированного `IOptions`/`IOptionsMonitor<ThrottleOptions>`
класс читает `IConfiguration.GetValue<int>` напрямую в методе. Нет класса опций, нет
валидации (`PerMinute <= 0` даст то же деление на 0, что и находка 5, но по другой причине -
корректный ключ с некорректным значением). Чем кончится: настройка throttle не проходит через
единый механизм валидации остальных опций сервиса; при будущем правиле валидации для Outbox
этот параметр останется непокрытым по конструкции, а не по забывчивости - его физически не с
чем регистрировать как `IValidateOptions<T>`.

## Minor

### 12. Дефолтные значения продублированы в env-файлах
`appsettings.Production.json:7-9` (`MaxBatchSize: 100`, `MaxInFlight: 5`, `MaxRetries: 5`) и
`appsettings.Staging.json:7` (`MaxRetries: 5`) буквально повторяют дефолты из
`appsettings.json:8-10`. Чем кончится: непонятно, какие значения - осознанный override
(`MinBatchSize` в Production, `MaxInFlight` в Staging), а какие - шум копипаста; при смене
дефолта в базовом файле эти «замороженные» копии молча разойдутся с новым дефолтом.

### 13. SmtpOptions: non-nullable свойства без `required` под `Nullable enable`
`Options/SmtpOptions.cs:5,7` (`Host`, `FromAddress`) - обычные `string` без `required`, при
этом `Notify.Worker.csproj:4` включает `<Nullable>enable</Nullable>`. Компилятор должен выдать
CS8618, но это предупреждение, а не ошибка компиляции - легко проигнорировать. Чем кончится:
именно эта пара свойств и приходит null-ом из-за находки 1 (секция `Mail` вместо `Smtp`) и падает
в рантайме, а не на этапе сборки, хотя `required` дал бы более раннюю и явную сигнализацию о
проблеме при построении конфигурации.

### 14. PollInterval - имя без единицы измерения
`Options/OutboxOptions.cs:5` - `PollInterval` не говорит, секунды это или миллисекунды (контраст
с `LockTimeout`, который `TimeSpan`/ISO-8601 и самодокументируется). Само по себе это стилевая
находка, но именно она обеспечила почву для находки 4 (500 трактовано как секунды вместо
миллисекунд) - `IntervalMs`/`PollIntervalMs` в имени сделал бы такую путаницу заметной на code
review до мержа.

## Итог по severity

- Blocker: 8
- Major: 3
- Minor: 3
