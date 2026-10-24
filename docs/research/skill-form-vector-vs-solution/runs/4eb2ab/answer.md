## Готово! Реализованы все три задачи биллинга:

**Созданные/изменённые файлы:**
- `Models.cs` — добавлена сущность `UnparsedStatement`
- `BillingDbContext.cs` — добавлен DbSet и конфигурация для неразобранных платежей
- `SubscriberService.cs` — добавлены методы `ProcessBankStatementAsync`, `SearchByPhoneAsync` и запись `BankStatementUploadResult`
- `Program.cs` — добавлены endpoints `POST /bank/statements` и `GET /subscribers/search`

**Ключевые решения:**

**(a) Загрузка выписки:** Эндпоинт парсит CSV, извлекает номер договора из назначения платежа, зачисляет баланс абонента. Дублирование предотвращается проверкой уникального `BankRef`. Неразобранные строки (абонент не найден) сохраняются отдельно в `UnparsedStatement`.

**(б) Реактивация:** При зачислении платежа проверяется статус — если Suspended и баланс >= 0, статус меняется на Active в одной транзакции.

**(в) Поиск:** `GET /subscribers/search?phone=4518` использует `EndsWith` для поиска по последним цифрам, лимит 20 результатов через `Take(20)`.