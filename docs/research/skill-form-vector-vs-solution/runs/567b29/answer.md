## Ревью завершено

Обнаружено **11 дефектов**, из них **5 CRITICAL**:

| Severity | Дефект | Файл | Причина |
|----------|--------|------|---------|
| **CRITICAL** | Секреты в Production конфиге | appsettings.Production.json | Пароли БД и API ключи открыто в репозитории |
| **CRITICAL** | MinBatchSize (200) > MaxBatchSize (100) | appsettings.Production.json | Нарушен инвариант конфигурации, система не стартует |
| **CRITICAL** | Неправильный раздел конфигурации | Program.cs:11 | GetSection("Mail") вместо "Smtp" — SmtpOptions не привяжется |
| **CRITICAL** | PollInterval в миллисекундах, но используется как секунды | OutboxWorker.cs:33 | Task.Delay(TimeSpan.FromSeconds(500)) вместо FromMilliseconds — 1000x медленнее |
| **CRITICAL** | SentAt устанавливается до отправки | OutboxWorker.cs:53 | Если отправка упадёт, письмо потеряется (SentAt != null, не переобработается) |
| HIGH | Валидатор не зарегистрирован | Program.cs | Ошибки конфигурации не обнаружены при старте |
| HIGH | Нет проверки MinBatchSize ≤ MaxBatchSize | OutboxOptionsValidator.cs | Кросс-полевой инвариант не enforced |
| HIGH | Ключ "MessagesPerMinute" vs "PerMinute" | ThrottleService.cs:7 | GetValue вернёт 0, деление на ноль в WaitAsync |
| HIGH | FromAddress отсутствует в Staging | appsettings.Staging.json | Non-nullable свойство без значения в env-файле |
| MEDIUM | ThrottleService не типобезопасна | ThrottleService.cs | Не использует IOptions, в отличие от остальных |
| MEDIUM | Имя PollInterval без единицы | OutboxOptions.cs | Ведёт к ошибкам использования (см. CRITICAL #4) |

Результат сохранён в `_answer.md`. **Merge невозможен** без исправления CRITICAL и HIGH дефектов.