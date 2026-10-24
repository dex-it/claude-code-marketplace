## Итоги ревью

Нашёл 14 дефектов, самые серьёзные — логическая порча outbox-паттерна и три конфиг-бага, ломающих базовую функциональность:

**Critical**
1. `OutboxWorker.ProcessBatchAsync` — `SentAt` проставляется до отправки и не откатывается при ошибке → неудачные письма никогда не повторяются, `MaxRetries` не работает, письма молча теряются.
2. `ThrottleService.WaitAsync` — читает `Throttle:MessagesPerMinute`, а в конфиге `Throttle:PerMinute` → гарантированный `DivideByZeroException` на первой же отправке.
3. `Program.cs` конфигурирует `SmtpOptions` из секции `"Mail"`, которой нигде нет (везде `"Smtp"`) → SMTP всегда биндится пустышкой, падение при отправке.
4. `OutboxWorker` использует `IOptions<OutboxOptions>` вместо `IOptionsMonitor<>` → не выполняет явное требование MR о live-reload лимитов.
5. `appsettings.Production.json` — реальные пароль БД и SMTP-ключ закоммичены открытым текстом.
6. `OutboxOptionsValidator` написан и покрыт тестами, но нигде не зарегистрирован и `.ValidateOnStart()` не вызван — валидация мертва.

**High**
7. `PollInterval` без единицы измерения: в конфиге явно миллисекунды (500 = "раз в полсекунды" по MR), а код делает `FromSeconds` → опрос раз в ~8 минут вместо 0.5 секунды.
8. Валидатор не проверяет `MinBatchSize` и инвариант `Min<=Max`; в Production `MinBatchSize=200 > MaxBatchSize=100`.
9. `SmtpOptions.Host/FromAddress` non-nullable без дефолта и без валидатора — ничего не остановит сервис при пустой конфигурации.

**Medium**: Staging агрессивнее Production по `MaxInFlight` без комментария; дублирование значений по умолчанию в env-файлах маскирует намерение; подстановка `${NOTIFY_DB_PASSWORD}` в Staging ничем в коде не обеспечена.

**Low**: `ThrottleService` работает через сырой `IConfiguration` вместо options-паттерна; потенциальная гонка при нескольких репликах воркера (SELECT+UPDATE без row-lock).

Полный список с обоснованием записан в `/Users/anonymous/.cache/research/runs/c0bb2d/work/_answer.md`.