## Ревью MR: Outbox-воркер рассылки уведомлений

**1. `tests/OutboxOptionsValidatorTests.cs` / `Notify.Worker.csproj`** — critical
Отдельного тестового `.csproj` нет, ссылки на Xunit в `Notify.Worker.csproj` нет, а файл теста попадёт в компиляцию worker-проекта через дефолтный glob SDK. Проект не соберётся.

**2. `Program.cs` — `Configure<SmtpOptions>(GetSection("Mail"))`** — critical
Во всех `appsettings.*.json` секция называется `"Smtp"`, а не `"Mail"`. `SmtpOptions` никогда не заполняется — отправка почты падает на каждом сообщении.

**3. `OutboxWorker.ProcessBatchAsync`** — critical
`m.SentAt = now` проставляется до попытки отправки. При ошибке отправки инкрементируется только `Attempts`, `SentAt` не сбрасывается — сообщение больше никогда не попадёт в выборку (`SentAt == null`). Ретраи и `MaxRetries` фактически не работают, сообщения молча теряются.

**4. `OutboxWorker.ExecuteAsync` — `TimeSpan.FromSeconds(o.PollInterval)`** — critical
Имя `PollInterval` без единицы измерения; значение `500` в конфиге явно задумано как мс (по описанию — «раз в полсекунды»), а код трактует как секунды → реальный интервал ~8.3 минуты вместо 0.5 сек.

**5. `OutboxWorker` конструктор — `IOptions<OutboxOptions>`** — critical
Нужен `IOptionsMonitor<OutboxOptions>`: `IOptions<T>.Value` кэшируется на весь срок жизни синглтона и не обновляется при правке appsettings — прямое нарушение требования MR про live-reload лимитов и размера пачки.

**6. `Program.cs` — `OutboxOptionsValidator` не зарегистрирован** — high
Класс написан и протестирован, но нигде не подключён (`IValidateOptions<OutboxOptions>` не зарегистрирован, `.ValidateOnStart()` не вызван) — валидация при старте не работает, класс мёртвый.

**7. `Options/OutboxOptionsValidator.cs`** — medium
Не проверяется `MinBatchSize > 0` и инвариант `MinBatchSize <= MaxBatchSize`. В `appsettings.Production.json` реально `MinBatchSize: 200 > MaxBatchSize: 100` — невалидное состояние прошло бы незамеченным даже при включённой валидации.

**8. `ThrottleService.WaitAsync`** — critical
Читает ключ `Throttle:MessagesPerMinute`, а в конфигах он называется `Throttle:PerMinute`. Всегда резолвится в 0 → `60_000 / perMinute` кидает `DivideByZeroException` на каждой отправке.

**9. `appsettings.Staging.json` vs `appsettings.Production.json` — `Outbox:MaxInFlight`** — high
Staging = 20, Production = 5 — Staging агрессивнее прода без задокументированной причины (нарушение принятого правила).

**10. `appsettings.Production.json` — секреты в открытом виде** — critical
Пароль БД и пароль SMTP-релея захардкожены в закоммиченном файле (Staging для сравнения использует `${NOTIFY_DB_PASSWORD}`).

**11. `appsettings.Staging.json` / `appsettings.Production.json` — избыточные ключи** — low
Несколько значений (`MaxRetries: 5`, `MaxBatchSize: 100`, `MaxInFlight: 5` в Production) дублируют дефолт из базового файла без реального отличия.

**12. `Options/SmtpOptions.cs`** — medium
`Host`/`FromAddress` non-nullable без значения и без валидации — отсутствие данных обнаружится только в рантайме при отправке письма, а не на старте.

Полный текст с деталями записан в `/Users/anonymous/.cache/research/runs/e5d81f/work/_answer.md`. Главные блокеры мерджа — пп. 1–5, 8 и 10.