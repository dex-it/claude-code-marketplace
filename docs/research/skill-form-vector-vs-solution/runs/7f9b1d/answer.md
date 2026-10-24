Ниже 19 находок: 4 critical, 7 high, 5 medium, 3 low. Этот же текст записан в `_answer.md`. В текущем виде сервис не отправит ни одного письма, но все письма будут помечены отправленными. Код я не менял, сборку и тесты не запускал.

## Critical

1. **`appsettings.Production.json`: секреты закоммичены в репозиторий** — critical
   Там лежат реальный пароль к prod-БД (`Password=Kx7!pQ2vR9wz`) и пароль SMTP-relay (`rl_live_9f3a1c77e2b04d6d`). Они уже есть в коммите `df994ac`, и удаление из HEAD их из истории не уберёт. Оба секрета нужно ротировать. В файле оставить только плейсхолдеры, а значения подставлять через переменные окружения (`ConnectionStrings__Notify`, `Smtp__Password`) или secret store.

2. **`OutboxWorker.ProcessBatchAsync`: `SentAt` проставляется до отправки, поэтому сообщения теряются** — critical
   `SentAt` ставится при захвате пачки и сохраняется ещё до отправки. Если отправка упала, `catch` только увеличивает `Attempts`, а `SentAt` не сбрасывает. Такое сообщение больше не попадёт в выборку и навсегда числится отправленным. Из-за этого `MaxRetries`, `Attempts` и `LockedUntil` фактически ничего не делают. То же при остановке: сообщения, которые были в работе, уже помечены отправленными. Нужно при захвате ставить только `LockedUntil`, а `SentAt` писать после успешного `SendAsync`.

3. **`Program.cs`: `SmtpOptions` биндятся к секции `"Mail"`, а в конфиге она называется `"Smtp"`** — critical
   В итоге `Host` и `FromAddress` равны `null`, и `MailboxAddress.Parse` в `SmtpMailSender.SendAsync` бросает исключение на каждом письме. Вместе с п.2 это значит, что каждое письмо тихо помечается отправленным, хотя не уходит.

4. **`ThrottleService.WaitAsync`: ключ `Throttle:MessagesPerMinute` не существует, получается деление на ноль** — critical
   В конфиге ключ называется `Throttle:PerMinute`, поэтому `GetValue<int>` возвращает 0, и `60_000 / 0` бросает исключение на каждом вызове. Это вторая независимая причина того, что ни одна отправка не проходит. Кроме того, настройка читается из `IConfiguration` в обход options-пайплайна, поэтому никак не проверяется. Нужны `ThrottleOptions` с проверкой диапазона и `ValidateOnStart`.

## High

5. **`OutboxWorker.ExecuteAsync`: `PollInterval: 500` читается как секунды** — high
   По MR опрос должен идти раз в полсекунды, а `TimeSpan.FromSeconds(500)` даёт паузу около 8,3 минуты, в 1000 раз дольше. Причина в том, что в имени настройки нет единицы. Переименовать в `PollIntervalMs` и использовать `FromMilliseconds`, либо хранить как TimeSpan.

6. **`OutboxWorker` (конструктор/`ExecuteAsync`): `IOptions<OutboxOptions>` не даёт требуемой смены настроек на лету** — high
   `IOptions` вычисляется один раз, поэтому правки `MaxInFlight` и размера пачки без рестарта не подхватятся, хотя MR именно это обещает. Воркер — singleton, поэтому нужен `IOptionsMonitor.CurrentValue`. Также `_batchSize` нужно зажимать в `[Min, Max]` на каждой итерации.

7. **`Program.cs` / `OutboxOptionsValidator`: валидатор не зарегистрирован и никогда не выполняется, `ValidateOnStart` нет** — high
   Есть валидатор и зелёный юнит-тест, но в DI регистрируется только `Configure<OutboxOptions>`, так что правила не проверяются. У `SmtpOptions` валидации нет совсем, с ней п.3 упал бы при старте.
   - Нужно зарегистрировать валидатор через `TryAddEnumerable` и включить `AddOptions().BindConfiguration().ValidateOnStart()`, для `SmtpOptions` так же.
   - В правилах не хватает проверок: `PollInterval > 0`, `MinBatchSize > 0`, `Min <= Max`, `MaxRetries > 0`. При `MaxRetries = 0` не выберется ни одно сообщение, а при `MinBatchSize = 0` адаптация может застрять на `_batchSize = 0`.
   - После включения валидации prod-конфиг перестанет проходить (п.8). Это ломающее изменение: исправлять конфиг, а не ослаблять правило.

8. **`OutboxWorker.ExecuteAsync` + `appsettings.Production.json`: адаптивный батчинг в prod тихо отключён** — high
   В prod `MinBatchSize: 200`, `MaxBatchSize: 100`: Min > Max. Инвариант проверяется тихим `if`, поэтому адаптация в prod просто не работает, и никакого сигнала об этом нет. Проверять инвариант при старте (п.7) и исправить prod-значения.

9. **`appsettings.Staging.json`: `${NOTIFY_DB_PASSWORD}` не подставляется** — high
   Конфигурация .NET не раскрывает `${…}`. Npgsql получит этот текст буквально как пароль, и подключение к БД на staging не пройдёт. Передавать всю строку подключения через переменную окружения `ConnectionStrings__Notify`.

10. **`Notify.Worker.csproj` / `tests/OutboxOptionsValidatorTests.cs`: тесты попадают в компиляцию воркера** — high
    Каталог `tests/` лежит внутри проекта, а SDK по умолчанию включает все `**/*.cs`. Пакет xunit не подключён, значит сборка сломается (CS0246). Нужен отдельный тестовый проект и `<Compile Remove="tests/**" />`.

11. **`OutboxWorker.ExecuteAsync`: любое исключение из `ProcessBatchAsync` останавливает хост** — high
    В цикле нет try/catch, поэтому при кратковременной недоступности БД в .NET 8 (`StopHost`) весь процесс останавливается. Исключения нужно ловить и логировать внутри итерации.

## Medium

12. **`OutboxWorker.ProcessBatchAsync`: захват пачки без блокировки строк** — medium
    Выборка и запись `LockedUntil` — две отдельные операции. Несколько экземпляров (или перекрытие при деплое) могут отправить одно письмо дважды. Нужен атомарный захват, например `FOR UPDATE SKIP LOCKED` или `UPDATE … RETURNING`.

13. **`OutboxWorker.ProcessBatchAsync`: `gate.WaitAsync` внутри `try`, а `Release()` в `finally`** — medium
    Если ожидание отменили, `Release()` освободит слот, который не был захвачен. Кроме того, `catch (Exception)` ловит отмену: на остановке растёт `Attempts` и пишется warning. `WaitAsync` вынести до `try`, отмену ловить отдельно.

14. **`ThrottleService.WaitAsync`: это задержка, а не ограничение скорости** — medium
    Каждая параллельная задача ждёт независимо, поэтому реальная скорость в `MaxInFlight` раз выше лимита. В prod это 5 × 1200 = 6000 писем в минуту вместо 1200. Нужен общий rate limiter, например `TokenBucketRateLimiter`.

15. **`appsettings.Staging.json`: `MaxInFlight: 20` при 5 в prod без объяснения** — medium
    Staging нагружен сильнее prod и не воспроизводит его поведение. Выровнять значения или записать причину.

16. **`Options/SmtpOptions.cs`: non-nullable `Host`/`FromAddress` без `required`** — medium
    Это даёт CS8618, а на деле `null` доходит до места использования и падает там (как раз случай п.3). Объявить их `required` и добавить `[Required]` с валидацией при старте.

## Low

17. **env-файлы: повторяются значения по умолчанию** — low
    `MaxInFlight: 5` и `MaxRetries: 5` в prod и `MaxRetries: 5` в staging совпадают с базовым конфигом. В env-файлах должны быть только отличия.

18. **`SmtpMailSender.SendAsync`: новое SMTP-подключение на каждое письмо** — low
    Лишняя задержка и нагрузка на relay; лучше переиспользовать подключение в пределах пачки.

19. **`appsettings.json`: в базовом конфиге пароль БД (`Password=notify`)** — low
    Это dev-значение, но лучше хранить его в user-secrets, а в репозитории оставить плейсхолдер.