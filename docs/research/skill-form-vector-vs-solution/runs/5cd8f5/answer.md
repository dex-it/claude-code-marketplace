## Итог ревью Notify.Worker

Нашёл 13 замечаний, 5 из них критические — три бага делают заявленную в MR функциональность нерабочей полностью, ещё один нарушает явное требование MR, и один — утечка секретов.

**Critical**
1. `OutboxWorker.ExecuteAsync` — `TimeSpan.FromSeconds(o.PollInterval)` с `PollInterval=500` даёт паузу ~8 минут вместо «раз в полсекунды».
2. `ThrottleService.WaitAsync` — читает несуществующий ключ `Throttle:MessagesPerMinute` (в конфиге `Throttle:PerMinute`) → `60000/0` → письма никогда не отправляются.
3. `OutboxWorker.ProcessBatchAsync` — `SentAt` проставляется ДО отправки и не сбрасывается при ошибке → неудачные/непроверенные отправки навсегда помечаются как «отправлено», ретраи не работают, возможна потеря писем.
4. `Program.cs`/`OutboxWorker` — используется `IOptions<OutboxOptions>` вместо `IOptionsMonitor<OutboxOptions>`, поэтому явное требование MR «менять лимит и размер пачки на лету без рестарта» не выполняется.
5. `appsettings.Production.json` — пароль БД и API-ключ SMTP-релея закоммичены в открытом виде.

**High**
6. Гонка между SELECT и захватом `LockedUntil` в `OutboxWorker.ProcessBatchAsync` — при нескольких инстансах воркера возможна двойная отправка.
7. `OutboxOptionsValidator` написан и протестирован, но не зарегистрирован в DI — валидация опций реально не работает.

**Medium**
8. `appsettings.Production.json`: `MinBatchSize(200) > MaxBatchSize(100)` — уже в репозитории, тихо отключает адаптивный батчинг.
9. Валидатор не проверяет `MinBatchSize <= MaxBatchSize`/`PollInterval > 0`.
10. `catch` в `OutboxWorker` ловит и `OperationCanceledException` при shutdown, тратя попытку ретрая.
11. `ThrottleService` — не настоящий общий rate-limiter, при `MaxInFlight > 1` лимит легко превышается.

**Low**
12. `SmtpOptions` — non-nullable строки без значений при включённом `Nullable`.
13. Тесты покрывают только (неиспользуемый) валидатор; `OutboxWorker`/`ThrottleService` не тестированы вовсе, хотя там основные баги.

Полный текст с деталями и кодом записан в `/Users/anonymous/.cache/research/runs/5cd8f5/work/_answer.md`.