# Ревью: Outbox-воркер рассылки уведомлений

Проверено: OutboxWorker.cs, Program.cs, ThrottleService.cs, NotifyDbContext.cs, SmtpMailSender.cs,
IMailSender.cs, Options/*.cs, appsettings*.json, Notify.Worker.csproj, tests/OutboxOptionsValidatorTests.cs.

## Blocker

### 1. PollInterval трактуется как секунды, а не миллисекунды
**OutboxWorker.cs:33** - `await Task.Delay(TimeSpan.FromSeconds(o.PollInterval), ct);`
Конфиг (`appsettings.json:6`) даёт `"PollInterval": 500`. Значение 500 явно задумано как миллисекунды
(описание MR: «опрос outbox раз в полсекунды»), но `TimeSpan.FromSeconds(500)` даёт задержку 500
секунд (~8.3 минуты) между итерациями опроса.
**Чем кончится**: воркер опрашивает outbox раз в 8+ минут вместо раза в полсекунды - основное
требование MR не выполняется, рассылка уведомлений задерживается на порядки.

### 2. MaxInFlight и размер пачки не подхватываются на лету
**OutboxWorker.cs:11** (`IOptions<OutboxOptions> options` в конструкторе), **:18** (`_batchSize = options.Value.MaxBatchSize`), **:22** (`var o = options.Value;`)
`IOptions<T>.Value` вычисляется один раз и кэшируется на всё время жизни объекта (документированное
поведение Microsoft: `IOptions<T>` не поддерживает чтение конфигурации после старта приложения).
`OutboxWorker` - singleton `BackgroundService`, поэтому `options.Value` держит снапшот конфигурации
на момент первого обращения навечно.
**Чем кончится**: прямое нарушение требования MR - «лимит параллельных отправок и размер пачки
должны меняться на лету правкой appsettings, без рестарта». Правка `MaxInFlight` / `MaxBatchSize` /
`MinBatchSize` в appsettings во время работы сервиса не даёт эффекта до перезапуска процесса. Нужен
`IOptionsMonitor<OutboxOptions>`.

### 3. Секция SMTP-конфига не совпадает с именем, которое биндит Program.cs
**Program.cs:11** - `builder.Services.Configure<SmtpOptions>(builder.Configuration.GetSection("Mail"));`
Во всех трёх appsettings-файлах секция называется `"Smtp"` (appsettings.json:13,
appsettings.Production.json:11, appsettings.Staging.json:9), секции `"Mail"` нигде нет.
**Чем кончится**: `SmtpOptions` всегда биндится к пустой секции - `Host`, `FromAddress` остаются
`null` несмотря на непустой (не-nullable) тип `string`. `SmtpClient.ConnectAsync(null, ...)` в
SmtpMailSender.cs:20 бросает `ArgumentNullException` на каждой отправке. Ни одно письмо не
отправляется никогда, независимо от валидности остальной логики.

### 4. Ключ throttle-конфига не совпадает с тем, что читает ThrottleService
**ThrottleService.cs:7** - `config.GetValue<int>("Throttle:MessagesPerMinute")`
В appsettings ключ называется `PerMinute` (appsettings.json:21: `"Throttle": { "PerMinute": 600 }`),
ключа `MessagesPerMinute` нет ни в одном файле.
**Чем кончится**: `GetValue<int>` на отсутствующий ключ возвращает `default(int) = 0`. Выражение
`60_000 / perMinute` (ThrottleService.cs:8) кидает `DivideByZeroException` при каждом вызове
`WaitAsync`. Исключение ловится try/catch в OutboxWorker.cs:66-70 и трактуется как неудачная отправка
письма (`m.Attempts++`), то есть письмо в принципе никогда не пытается уйти по SMTP - throttle
гарантированно валит любую отправку.

### 5. SentAt проставляется до фактической отправки, а не по её результату
**OutboxWorker.cs:52-54**
```
m.LockedUntil = now + o.LockTimeout;
m.SentAt = now;
```
это выполняется и коммитится (`SaveChangesAsync`, строка 55) сразу после выборки батча, до вызова
`sender.SendAsync`. При неудаче отправки (catch-блок, строки 66-70) `m.Attempts++` увеличивается, но
`SentAt` обратно в `null` не сбрасывается. Условие выборки следующей итерации - `m.SentAt == null`
(строка 44).
**Чем кончится**: любая транзиентная ошибка отправки (таймаут SMTP, разрыв соединения, падение
процесса между строками 55 и 77) навсегда помечает сообщение как отправленное, хотя оно не было
доставлено. Retry-логика (`MaxRetries`, `Attempts`) фактически не работает: сообщение выпадает из
выборки после первой же попытки независимо от исхода. Тихая потеря уведомлений.

### 6. Проект не компилируется: тестовый файл лежит в основном проекте без ссылки на xunit
**tests/OutboxOptionsValidatorTests.cs:1-2** (`using Xunit;`) и **Notify.Worker.csproj** (весь файл)
В каталоге один-единственный `.csproj` - `Notify.Worker.csproj`, это `Microsoft.NET.Sdk.Worker`-проект
без отдельного тестового проекта. SDK-style проект по умолчанию инклюдит `**/*.cs` рекурсивно
(папка `tests/` не входит в дефолтные исключения), значит `OutboxOptionsValidatorTests.cs`
компилируется как часть `Notify.Worker.csproj`. Пакеты `xunit`/`Microsoft.NET.Test.Sdk` в
`Notify.Worker.csproj` не подключены (см. список `PackageReference`, строки 8-11).
**Чем кончится**: сборка падает с `CS0246` («The type or namespace name 'Xunit' could not be found»)
- сервис в текущем виде не собирается вообще.

### 7. Продовые секреты в открытом виде в репозитории
**appsettings.Production.json:3** - пароль БД `Kx7!pQ2vR9wz` в connection string;
**appsettings.Production.json:16** - пароль SMTP-релея `rl_live_9f3a1c77e2b04d6d`.
Для сравнения appsettings.Staging.json:3 корректно не хранит пароль в файле, а ссылается на
переменную окружения.
**Чем кончится**: боевые credentials БД и SMTP-релея утекают в историю git и всем, у кого есть
доступ к репозиторию/форкам; ротация пароля не устраняет утечку самого факта коммита. Требует
немедленной ротации паролей и переноса секретов в vault/env/user-secrets.

## Major

### 8. `${NOTIFY_DB_PASSWORD}` в appsettings.Staging.json не разворачивается
**appsettings.Staging.json:3** - `"Password=${NOTIFY_DB_PASSWORD}"`
Стандартный `Microsoft.Extensions.Configuration.Json` не подставляет переменные окружения внутри
значений строк - такой интерполяции из коробки нет, а в Program.cs нет кастомного provider'а/
пост-обработки, который бы это делал.
**Чем кончится**: на Staging Npgsql получит буквальную строку `${NOTIFY_DB_PASSWORD}` как пароль и
не подключится к БД (аутентификация всегда будет падать).

### 9. OutboxOptionsValidator существует, но никогда не вызывается
**Program.cs** (нет регистрации) и **Options/OutboxOptionsValidator.cs:1-16**
`OutboxOptionsValidator` реализует `IValidateOptions<OutboxOptions>` и покрыт тестами
(`tests/OutboxOptionsValidatorTests.cs`), но в Program.cs нет
`services.AddSingleton<IValidateOptions<OutboxOptions>, OutboxOptionsValidator>()` и нет
`.ValidateOnStart()`. Опции регистрируются только через `Configure<OutboxOptions>(...)`
(Program.cs:10), без какой-либо связки с валидатором.
**Чем кончится**: класс мёртвый код с точки зрения runtime - никакая проверка конфигурации при
старте не выполняется, невалидные appsettings (см. находку 10) не блокируют запуск и не логируются,
проверяются только тестом.

### 10. Production-конфиг невалиден (MinBatchSize > MaxBatchSize), это никем не ловится
**appsettings.Production.json:6-7** - `"MinBatchSize": 200, "MaxBatchSize": 100`
`MinBatchSize` больше `MaxBatchSize`. Валидатор (см. находку 9) это не проверяет и не вызывается, так
что ничего не мешает такой конфигурации попасть в прод.
**Чем кончится**: в `OutboxWorker.cs:25` условие `o.MinBatchSize < o.MaxBatchSize` ложно, адаптивная
логика batch size полностью отключается без единого лога/предупреждения - поведение расходится с
намерением автора конфигурации, и никто не узнает об этом до ручного разбирательства.

### 11. Throttle не ограничивает реальную скорость отправки при параллелизме
**ThrottleService.cs:5-9**
`WaitAsync` просто делает фиксированную задержку `Task.Delay(60_000 / perMinute)` перед каждой
отправкой. В OutboxWorker.cs (строки 58-75) до `MaxInFlight` сообщений обрабатываются параллельно, и
каждая параллельная задача ждёт свой независимый таймер, после чего отправляет. Нет общего
токен-бакета/семафора, размеченного по времени.
**Чем кончится**: даже если исправить несовпадение ключа (находка 4), фактическая скорость отправки
будет примерно в `MaxInFlight` раз выше заданного `PerMinute` (несколько параллельных «дорожек»
throttle вместо одной общей) - лимит на исходящий поток писем не соблюдается.

### 12. Необработанное исключение на шаге выборки/захвата останавливает весь процесс
**OutboxWorker.cs:16-35, 37-55**
Тело `ExecuteAsync` и первая половина `ProcessBatchAsync` (запрос `ToListAsync`, первый
`SaveChangesAsync` на строке 55) не обёрнуты в try/catch, в отличие от отправки одного письма
(строки 61-74). Начиная с .NET 6 дефолтное поведение `BackgroundService` при необработанном
исключении - `HostOptions.BackgroundServiceExceptionBehavior = StopHost`, то есть хост останавливается
целиком.
**Чем кончится**: любой транзиентный сбой БД (обрыв соединения, дедлок, недоступность Postgres на
секунду) на шаге выборки/локирования батча роняет весь воркер, а не только текущую итерацию - для
восстановления рассылки нужен внешний рестарт процесса.

### 13. Нет миграции и индекса под таблицу Outbox
**NotifyDbContext.cs** (весь файл) - в каталоге нет папки `Migrations/`, схема БД никак не
создаётся и не версионируется этим сервисом; сам горячий предикат опроса
(`SentAt == null && Attempts < MaxRetries && (LockedUntil == null || LockedUntil < now)`,
OutboxWorker.cs:44-45) с `OrderBy(CreatedAt)` не имеет ни одного индекса в конфигурации контекста.
**Чем кончится**: если это MR целиком новый сервис (как сказано в описании), таблицу `Outbox`
физически негде создать без ручного DDL за пределами репозитория; при появлении реальной схемы
(вручную или из другого места) опрос каждые 500 мс без индекса на эти колонки даёт полный скан
таблицы, деградирующий с ростом outbox.

## Minor

### 14. SmtpOptions.Host / FromAddress не-nullable без значения по умолчанию
**Options/SmtpOptions.cs:5,7**
```
public string Host { get; set; }
public string FromAddress { get; set; }
```
При включённом `<Nullable>enable</Nullable>` (Notify.Worker.csproj:4) это даёт предупреждение
CS8618 («Non-nullable property must contain a non-null value») - непоследовательно на фоне
`OutboxMessage.To/Subject/Body`, у которых есть `= ""` (NotifyDbContext.cs:8-10).
**Чем кончится**: шум предупреждений при сборке; расхождение в стиле с остальным кодом того же MR.

### 15. Нет терминального статуса для сообщений, исчерпавших MaxRetries
**OutboxWorker.cs:44** - условие `m.Attempts < o.MaxRetries` просто перестаёт включать строку в
выборку после исчерпания попыток, без установки какого-либо признака «окончательно не доставлено».
**Чем кончится**: по данным одной этой таблицы невозможно отличить «ещё не отправлено, ждёт своей
очереди» от «отправка окончательно провалена» - нужен ручной анализ по `Attempts`/`LockedUntil`,
никакого лога/метрики о финальном отказе не появляется.

## Итог по severity

- blocker: 7
- major: 6
- minor: 2
