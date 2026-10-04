# Review: Outbox-воркер рассылки уведомлений

Заявлено в описании MR: опрос outbox раз в полсекунды; лимит параллельных отправок и
размер пачки меняются на лету правкой appsettings, без рестарта. Ниже — находки по коду
и конфигурации каталога C-c1, код не менялся.

## Blocker

### 1. `OutboxWorker.cs:33` — PollInterval трактуется как секунды, а не как объявленные полсекунды
```csharp
await Task.Delay(TimeSpan.FromSeconds(o.PollInterval), ct);
```
`appsettings.json:6` задаёт `"PollInterval": 500` — по описанию MR это 0.5 сек, но
`TimeSpan.FromSeconds(500)` = 500 секунд (~8.3 минуты) между опросами outbox во всех
окружениях (Production/Staging значение не переопределяют). Итог: воркер опрашивает outbox
в ~1000 раз реже заявленного, письма уходят с многоминутной задержкой — требование MR не
выполнено буквально.

### 2. `Program.cs:11` — SmtpOptions биндится из секции `"Mail"`, которой нет ни в одном appsettings
```csharp
builder.Services.Configure<SmtpOptions>(builder.Configuration.GetSection("Mail"));
```
Во всех трёх файлах (`appsettings.json:13`, `appsettings.Production.json:11`,
`appsettings.Staging.json:9`) секция называется `"Smtp"`. `SmtpOptions` всегда биндится в
дефолты: `Host = null`, `Port = 0`, `FromAddress = null`. Итог: `SmtpMailSender.SendAsync`
(`SmtpMailSender.cs:14` — `MailboxAddress.Parse(o.FromAddress)`, `SmtpMailSender.cs:20` —
`client.ConnectAsync(o.Host, o.Port, ...)`) кидает исключение на каждой попытке отправки —
письма не уходят вообще, ни в одном окружении.

### 3. `ThrottleService.cs:7` — ключ конфигурации не совпадает с appsettings, деление на ноль
```csharp
var perMinute = config.GetValue<int>("Throttle:MessagesPerMinute");
return Task.Delay(60_000 / perMinute, ct);
```
`appsettings.json:21` определяет `Throttle:PerMinute`, а не `Throttle:MessagesPerMinute`.
`GetValue<int>` на отсутствующем ключе возвращает `default(int) = 0` → `60_000 / 0` бросает
`DivideByZeroException` при каждом вызове `throttle.WaitAsync` (`OutboxWorker.cs:63`).
Исключение ловится общим `catch` в `OutboxWorker.cs:66-70`, поэтому каждое сообщение падает
на throttle-шаге раньше, чем дойдёт до `sender.SendAsync` — независимо от находки №2.

### 4. `OutboxWorker.cs:50-55` — `SentAt` проставляется до отправки, retry-механизм не работает
```csharp
foreach (var m in batch)
{
    m.LockedUntil = now + o.LockTimeout;
    m.SentAt = now;
}
await db.SaveChangesAsync(ct);
```
Выборка фильтрует по `m.SentAt == null` (`OutboxWorker.cs:44`), а `SentAt` записывается сразу
после SELECT, до попытки реальной отправки. Если отправка падает (что при находках №2/№3
происходит всегда), код инкрементит `Attempts` (`OutboxWorker.cs:68`), но строка уже закоммичена
с непустым `SentAt` — при следующем опросе она больше никогда не попадёт в выборку.
Условия `m.Attempts < o.MaxRetries` и `m.LockedUntil == null || m.LockedUntil < now`
(`OutboxWorker.cs:44-45`) в результате мёртвые: до них дело не доходит, потому что `SentAt`
уже не null. Итог: любое сообщение, у которого отправка не удалась хоть раз, помечено как
отправленное навсегда и молча теряется — контракта надёжности outbox (retry по `MaxRetries`)
нет, хотя поля `Attempts`/`MaxRetries`/`LockedUntil` создают у ревьюера обратное впечатление.

### 5. `appsettings.Staging.json:3` — `${NOTIFY_DB_PASSWORD}` не подставляется .NET-конфигурацией
```json
"ConnectionStrings": { "Notify": "Host=pg-stage.internal;...;Password=${NOTIFY_DB_PASSWORD}" }
```
Синтаксис `${VAR}` — это соглашение shell/docker-compose, не .NET `IConfiguration`. В
`Program.cs` нет кастомного провайдера конфигурации, который бы разворачивал такие плейсхолдеры
внутри JSON-значений; штатные провайдеры (`appsettings.{env}.json` + env vars) их не трогают.
Итог: в Staging в connection string попадёт буквальная строка `${NOTIFY_DB_PASSWORD}` как пароль
— подключение к БД в этом окружении не установится.

### 6. `Notify.Worker.csproj` + `tests/OutboxOptionsValidatorTests.cs:2` — проект не собирается в текущей раскладке
Тестовый файл лежит внутри дерева каталога основного проекта, отдельного `.csproj` для
`tests/` нет (в списке файлов каталога — только один `Notify.Worker.csproj`). SDK-style проект
(`Microsoft.NET.Sdk.Worker`, `Notify.Worker.csproj:1`) по умолчанию глобит `**/*.cs` в
компиляцию, и исключение подпапки происходит только если в ней лежит свой файл проекта —
такого файла нет. При этом `Notify.Worker.csproj:7-12` не содержит `PackageReference` на
`xunit`/`Microsoft.NET.Test.Sdk`. Итог: `using Xunit;` (`tests/OutboxOptionsValidatorTests.cs:2`)
и атрибуты `[Fact]` не резолвятся — сборка всего воркера (не только тестов) падает как есть,
без отдельного шага `dotnet test`.

### 7. `OutboxWorker.cs:11` — `IOptions<OutboxOptions>` не поддерживает live-reload, что прямо противоречит цели MR
```csharp
IOptions<OutboxOptions> options,
```
и далее `options.Value` в `OutboxWorker.cs:18,22`. `IOptions<T>` вычисляется один раз и не
реагирует на изменения файла конфигурации после старта хоста (документированное поведение
.NET options: для этого существуют `IOptionsMonitor<T>`/`IOptionsSnapshot<T>`, причём
`IOptionsSnapshot<T>` бесполезен в singleton `BackgroundService`, так как пересчитывается на
scope, а не по требованию). Описание MR требует: «Лимит параллельных отправок и размер пачки
должны меняться на лету правкой appsettings, без рестарта» — правка `MaxInFlight`,
`MaxBatchSize`, `MinBatchSize` в файле конфигурации после старта процесса эффекта не даст,
пока процесс не перезапущен. Это ключевое требование MR технически не реализовано.

### 8. `appsettings.Production.json:3,16` — продовые секреты закоммичены в открытом виде
```json
"Notify": "Host=pg-prod-01.internal;Database=notify;Username=notify_app;Password=Kx7!pQ2vR9wz"
...
"Password": "rl_live_9f3a1c77e2b04d6d"
```
Пароль прод-БД и живой ключ SMTP-релея лежат в репозитории литералом (в отличие от
`appsettings.Staging.json:3`, где пароль БД корректно выведен в переменную окружения). Секреты
уже попали в историю git и подлежат немедленной ротации независимо от исхода ревью.

## Major

### 1. `appsettings.Production.json:6-7` — `MinBatchSize` (200) больше `MaxBatchSize` (100), адаптивная логика пачки в Prod не работает
```json
"MinBatchSize": 200,
"MaxBatchSize": 100,
```
В базовом `appsettings.json:7-8` порядок корректный (20 < 100), в Production он инвертирован.
Условие `OutboxWorker.cs:25` — `if (o.MinBatchSize < o.MaxBatchSize)` — в Production всегда
`false`, поэтому ветка адаптивного роста/сжатия пачки (`OutboxWorker.cs:26-31`) не выполняется
никогда, и `_batchSize` навечно фиксируется значением, вычисленным при старте
(`OutboxWorker.cs:18`). Даже если исправить находку №7 (live-reload), пачка в Prod жить своей
жизнью не начнёт из-за этой инверсии.

### 2. `Options/OutboxOptionsValidator.cs:9-14` — валидация не покрывает `MinBatchSize`, соотношение Min/Max и `PollInterval`
```csharp
if (o.MaxBatchSize <= 0) errors.Add("MaxBatchSize must be positive");
if (o.MaxInFlight <= 0) errors.Add("MaxInFlight must be positive");
if (o.MaxRetries < 0) errors.Add("MaxRetries must be non-negative");
if (o.LockTimeout <= TimeSpan.Zero) errors.Add("LockTimeout must be positive");
```
Нет проверки `MinBatchSize > 0`, нет проверки `MinBatchSize <= MaxBatchSize`, нет проверки
`PollInterval > 0`. Именно поэтому находка Major №1 (Production Min>Max) и Blocker №1
(PollInterval=500 как секунды) не были бы отловлены валидатором даже при его подключении.

### 3. `Program.cs` — `OutboxOptionsValidator` не зарегистрирован в DI
В файле нет ни `services.AddSingleton<IValidateOptions<OutboxOptions>, OutboxOptionsValidator>()`,
ни `.ValidateOnStart()`. Класс существует и покрыт тестами
(`tests/OutboxOptionsValidatorTests.cs`), но в самом приложении никогда не вызывается — при
старте хоста некорректные `OutboxOptions` (включая Production Min>Max) не будут пойманы,
несмотря на наличие валидатора в диффе, создающее у ревьюера ложное чувство защиты.

### 4. `ThrottleService.cs:5-9` — throttle не имеет общего состояния между параллельными отправками
```csharp
public Task WaitAsync(CancellationToken ct)
{
    var perMinute = config.GetValue<int>("Throttle:MessagesPerMinute");
    return Task.Delay(60_000 / perMinute, ct);
}
```
Каждый вызов независимо считает одну и ту же задержку и ждёт её — нет ни семафора, ни
token bucket, ни общей метки «когда можно следующему». `OutboxWorker.cs:57-76` запускает до
`MaxInFlight` параллельных задач, каждая из которых вызывает `throttle.WaitAsync` — все они
ждут одинаковый интервал одновременно и затем шлют письма одновременно. Итог: реальный
темп отправки определяется `MaxInFlight`, а не `PerMinute` — троттлинг не ограничивает
агрегированную нагрузку на почтовый релей, только добавляет фиксированную задержку перед
каждым письмом.

### 5. `OutboxWorker.cs:37-56` — выборка и «захват» строк outbox не атомарны, нет защиты от параллельных инстансов
SELECT (`OutboxWorker.cs:43-48`) и последующий UPDATE `SentAt`/`LockedUntil`
(`OutboxWorker.cs:50-55`) — два отдельных round-trip без транзакции, без `FOR UPDATE SKIP LOCKED`
и без optimistic-concurrency токена на `OutboxMessage` (`NotifyDbContext.cs:5-15`). Ничто в коде
или конфигурации не запрещает запускать более одной реплики воркера. При горизонтальном
масштабировании (обычная практика для background-воркеров) два инстанса могут выбрать и
отправить одни и те же строки — дублирующая отправка писем получателю.

## Minor

### 1. `Options/SmtpOptions.cs:5,7` — нет валидатора и дефолтов для обязательных полей
```csharp
public string Host { get; set; }
...
public string FromAddress { get; set; }
```
При включённом `<Nullable>enable</Nullable>` (`Notify.Worker.csproj:4`) это должно давать
предупреждение CS8618, а главное — в отличие от `OutboxOptions`, для `SmtpOptions` вообще нет
`IValidateOptions<SmtpOptions>`. Некорректная конфигурация (в том числе находка Blocker №2)
проявится не явной ошибкой при старте, а NRE/исключением связи глубоко внутри
`SmtpMailSender`.

### 2. `Options/OutboxOptions.cs:5` — имя `PollInterval` без единицы измерения
```csharp
public int PollInterval { get; set; }
```
Ни в имени, ни в комментарии не указано, секунды это или миллисекунды — именно эта
неоднозначность и привела к рассинхрону в Blocker №1. Соседнее поле `LockTimeout` типизировано
как `TimeSpan` и такой проблемы не имеет — стоит привести `PollInterval` к тому же паттерну
или явно назвать единицу в имени (`PollIntervalMs`).

### 3. `ThrottleService.cs:3` — throttle читает конфигурацию мимо Options-паттерна, принятого в проекте
```csharp
public class ThrottleService(IConfiguration config)
```
`OutboxOptions`/`SmtpOptions` биндятся через `IOptions<T>` с секцией и (для Outbox) валидатором;
`ThrottleService` читает `IConfiguration` напрямую по строковому ключу без какой-либо проверки
на старте. Несогласованный подход в рамках одного и того же MR и, как следствие находки
Blocker №3, ничто не мешало разойтись именам ключей.

## Итог

Blocker: 8
Major: 5
Minor: 3
Всего находок: 16
