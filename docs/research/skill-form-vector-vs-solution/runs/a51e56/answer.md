## Итог ревью

**Critical**
1. `OutboxWorker.ProcessBatchAsync` — `SentAt` проставляется до отправки, ретраи не работают, упавшие письма помечаются как отправленные.
2. `Program.cs` биндит `SmtpOptions` из секции `"Mail"`, а во всех appsettings секция `"Smtp"` — конфиг SMTP всегда пустой.
3. `ThrottleService.WaitAsync` читает `Throttle:MessagesPerMinute`, а в конфиге `Throttle:PerMinute` → деление на 0 на каждом вызове, письма никогда не отправляются (перехватывается общим catch).
4. `OutboxWorker.ExecuteAsync` — `TimeSpan.FromSeconds(o.PollInterval)` при значении 500 даёт паузу ~8 минут вместо заявленных 0.5 секунды.
5. Тестовый файл `tests/OutboxOptionsValidatorTests.cs` использует Xunit, но нет отдельного test-проекта и ссылки на Xunit в `Notify.Worker.csproj` — решение не соберётся.
6. `appsettings.Production.json` — закоммичены реальные пароль БД и SMTP API-ключ в открытом виде.

**High**
7. `OutboxOptions` внедряется через `IOptions<T>` вместо `IOptionsMonitor<T>` — живой reload `MaxBatchSize`/`MaxInFlight` из MR-требования не работает.
8. `OutboxOptionsValidator` написан и протестирован, но нигде не зарегистрирован в DI — мёртвый код, некорректный конфиг не ловится при старте.

**Medium**
9. Общий `DbContext` мутируется из параллельных задач (`Task.WhenAll`) — не потокобезопасно.
10. Throttle не имеет общего состояния между параллельными отправками — реальный rate-limit не соблюдается.
11. Валидатор не проверяет `MinBatchSize <= MaxBatchSize`; в `Production.json` уже нарушено (200 > 100), адаптивный батчинг молча отключается.

**Low**
12. Переменная `sent` в адаптивной логике батчинга на деле означает "взято в обработку", а не "успешно отправлено" — вводит в заблуждение.
13. `SmtpOptions.Host/FromAddress` без `required`/валидации — тихий `null` при неверной конфигурации.

Полный текст с обоснованиями сохранён в `/Users/anonymous/.cache/research/runs/a51e56/work/_answer.md`.