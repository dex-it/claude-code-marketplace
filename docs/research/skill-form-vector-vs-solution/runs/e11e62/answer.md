Прочитал весь код и конфиги MR. Сборку и тесты не запускал, код не менял. Тот же ответ записан в `_answer.md`.

## Critical

1. **`OutboxWorker.ProcessBatchAsync`: `SentAt = now` ставится до отправки, а при ошибке не сбрасывается.**
   - Упавшее сообщение больше никогда не выберется: фильтр `SentAt == null` его отсекает.
   - Поэтому ретраев нет, а `MaxRetries` и `LockedUntil` фактически не работают.
   - Письма молча теряются и в БД числятся отправленными.
   - При падении процесса между двумя `SaveChangesAsync` происходит то же самое: получается at-most-once, а outbox должен давать at-least-once.
   - Как исправить: до отправки ставить только lock, а `SentAt` писать после успешного `SendAsync`.

2. **`ThrottleService.WaitAsync`: ключ конфигурации не совпадает.**
   - Код читает `Throttle:MessagesPerMinute`, а в конфигах ключ называется `Throttle:PerMinute`.
   - Из-за этого `perMinute = 0`, и `60_000 / 0` бросает `DivideByZeroException`.
   - Исключение ловится в `catch` воркера, так что каждая отправка «падает» и ни одно письмо не уходит. По п.1 все сообщения при этом помечаются отправленными.
   - Защиты от `perMinute <= 0` тоже нет.

3. **`Program.cs`: SMTP-опции берутся из секции `"Mail"`, а в конфигах она называется `"Smtp"`.**
   - `SmtpOptions` остаются пустыми (`Host`/`FromAddress` = null, `Port` = 0), и отправка падает в любом окружении.
   - Валидации и `ValidateOnStart` нет, поэтому сервис стартует «зелёным».

4. **`appsettings.Production.json`: в репозиторий закоммичены боевые секреты.**
   - Там лежат пароль к БД `pg-prod-01` и пароль SMTP-релея (`rl_live_...`).
   - Их нужно ротировать и вынести в secret store или переменные окружения. Простого удаления из файла недостаточно, они останутся в git-истории.

5. **`OutboxWorker.ExecuteAsync`: `PollInterval = 500` трактуется как секунды.**
   - `TimeSpan.FromSeconds(500)` даёт паузу 8 мин 20 с, а по описанию MR опрос должен идти раз в 0.5 с.
   - Нужно `FromMilliseconds` или тип `TimeSpan` в опциях.

## High

6. **`OutboxWorker`: `IOptions<OutboxOptions>` не перечитывается на лету.**
   - `IOptions` в singleton — это снимок на момент старта, а MR требует менять настройки без рестарта. Нужен `IOptionsMonitor.CurrentValue`.
   - Кроме того, `_batchSize` клампится к новому `MaxBatchSize` только в ветке `Min < Max`, поэтому при изменении на лету может остаться старое значение.

7. **`OutboxWorker.ProcessBatchAsync`: захват строк не атомарный.**
   - Сначала `SELECT`, потом отдельный `UPDATE`, без `FOR UPDATE SKIP LOCKED` и без concurrency token.
   - При нескольких репликах или rolling-деплое одни и те же письма уйдут дважды.

8. **`OutboxWorker.ExecuteAsync`: в цикле нет try/catch.**
   - Любой транзиентный сбой БД выходит из `ExecuteAsync`.
   - В .NET 8 по умолчанию `BackgroundServiceExceptionBehavior.StopHost`, так что останавливается весь сервис.

9. **`tests/OutboxOptionsValidatorTests.cs` лежит внутри проекта `Notify.Worker`: сборка сломается.**
   - SDK по умолчанию компилирует все `**/*.cs`, значит тест попадает в основной проект.
   - Пакета xunit там нет, поэтому `using Xunit` не скомпилируется.
   - Нужен отдельный тестовый проект и исключение `tests/**` из основного csproj.

10. **`OutboxOptionsValidator` не зарегистрирован, и в нём нет ключевых проверок.**
    - Валидатор не зарегистрирован в DI, `ValidateOnStart` нет, так что это мёртвый код.
    - Не проверяется `MinBatchSize > 0`. При `Min = 0` `_batchSize` может упасть до 0 и навсегда там остаться (`Take(0)` → 0 → `0*2`), воркер перестанет выбирать сообщения.
    - Не проверяется `Min <= Max`. В Production сейчас `MinBatchSize` 200 больше `MaxBatchSize` 100, и это никто не ловит.
    - Не проверяются `PollInterval > 0` и `MaxRetries > 0`.

## Medium

11. **`appsettings.Staging.json`: `${NOTIFY_DB_PASSWORD}` не подставляется.**
    Конфигурация .NET не раскрывает такие плейсхолдеры, строка уйдёт как буквальный пароль, и Staging не подключится к БД.

12. **`ProcessBatchAsync` + `ThrottleService`: троттлинг не ограничивает общий темп.**
    - Задержка вызывается внутри каждой из `MaxInFlight` параллельных задач, поэтому реальный темп ≈ `MaxInFlight × PerMinute`. В Staging это в 20 раз больше заданного.
    - Нужен общий limiter, например `TokenBucketRateLimiter`.

13. **`ProcessBatchAsync`: неправильная обработка отмены при остановке.**
    - `catch (Exception)` ловит `OperationCanceledException`, и при штатной остановке у сообщений растёт `Attempts`.
    - Финальный `SaveChangesAsync(ct)` с отменённым токеном бросает исключение, и результаты уже отправленных писем не сохраняются.
    - `gate.WaitAsync` стоит вне try, поэтому `Task.WhenAll` падает с OCE.

14. **`ProcessBatchAsync`: один `LockTimeout` (30 с) на всю пачку.**
    Пачка с троттлингом и новым SMTP-соединением на каждое письмо может обрабатываться дольше. После истечения лока сообщения заберёт другая реплика, и снова будут дубли.

## Low

15. **`SmtpMailSender.SendAsync`: новое соединение и аутентификация на каждое письмо.** Лишняя нагрузка на релей и риск упереться в его лимиты подключений.
16. **`SmtpMailSender.SendAsync`: не задан `SecureSocketOptions`.** С `Auto` на 587 пароль может уйти открытым текстом, если сервер не объявит STARTTLS. Лучше явно указать `StartTls`.
17. **`NotifyDbContext`: нет конфигурации модели.** Нет индекса под запрос опроса (частичного по `CreatedAt` с условием `SentAt IS NULL`), нет concurrency token, нет миграций.
18. **`SmtpOptions`: non-nullable `Host`/`FromAddress` без инициализации.** Это предупреждения CS8618, а `null` в рантайме ничем не отлавливается.