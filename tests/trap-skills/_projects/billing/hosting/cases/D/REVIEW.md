# Ревью MR !31 «Напоминания о просрочке, пеня, повтор проводки при таймауте, валюты из конфигурации»

Ревизия: {{X}}
Вердикт: нужны правки до мерджа.

## Находки

1. `src/Billing.Api/Application/Handlers/Invoices/SendDueRemindersHandler.cs:24-25`
   Пеня считается как `invoice.Amount.Minor * daysLate / 1000` и проводится каждый день заново: за 10 дней
   просрочки клиент заплатит 1+2+...+10 = 55 промилле вместо 10. Плюс проводка пени идёт прямым
   `ledger.PostAsync(...)` мимо outbox, а ADR-0006 запрещает новый код через `ILedgerGateway`.
   Исправление: начислять пеню за один день (`Minor / 1000`) или от последней начисленной; проводку -
   `LedgerPostingRequested` через `IOutbox`, как в `CancelInvoiceHandler`.
   Severity: blocker.

2. `src/Billing.Api/Infrastructure/Ledger/LedgerOutboxDispatcher.cs:51-52`
   Комментарий утверждает, что `Acme.Ledger.Client` 2.3.1 ставит `Idempotency-Key = entry.ExternalId`.
   Это не так: клиент генерирует ключ `Guid.NewGuid()` на каждый вызов `PostEntryAsync` (проверено
   декомпиляцией пакета). Повтор после таймаута, когда первый запрос дошёл до Ledger, создаёт вторую
   проводку.
   Исправление: таймаут не повторять внутри тика - сообщение останется в outbox и уйдёт на следующем
   тике; комментарий убрать.
   Severity: blocker.

3. `src/Billing.Api/Infrastructure/Ledger/LedgerOutboxDispatcher.cs:64`
   `_ = Task.Delay(...)` не ждётся: повторы идут подряд без паузы.
   Исправление: `await Task.Delay(TimeSpan.FromMilliseconds(300 * (attempt + 1)), ct);`.
   Severity: major.

4. `src/Billing.Api/Modules/NotificationsModule.cs:23`
   `AddSingleton<SendDueRemindersHandler>()` захватывает scoped `IInvoiceRepository` и `ILedgerGateway`
   на всё время жизни приложения (captive dependency). Ссылка на `LedgerOutboxDispatcher` не подходит:
   тот зависит только от синглтонов.
   Исправление: `AddScoped`, а `InvoiceReminderWorker` создаёт scope на каждый тик.
   Severity: major.

5. `src/Billing.Api/Application/Handlers/Invoices/SendDueRemindersHandler.cs:29`, `:36`
   Сигнатура `NotifyAsync(Guid customerId, Guid invoiceId, ...)`, а вызов передаёт
   `invoice.Id.Value, invoice.CustomerId.Value`: письмо уходит на id счёта как на клиента. Сырые `Guid`
   при typed-id в проекте позволили перепутать порядок без ошибки компиляции.
   Исправление: параметры `CustomerId` и `InvoiceId` в сигнатуре.
   Severity: blocker.

6. `src/Billing.Api/Application/Handlers/Invoices/CancelInvoiceHandler.cs`, удалённые строки 16-17
   Удалена проверка статуса перед отменой: отмена черновика теперь проходит, а повторная отмена
   оплаченного счёта ставит в outbox второе сторно на полную сумму.
   Исправление: вернуть проверку `Status is not (Issued or Paid)`.
   Severity: major.

## Общий комментарий

Спасибо за MR. Основное: пеня начисляется кумулятивно и проводится мимо outbox (SendDueRemindersHandler),
комментарий про Idempotency-Key в LedgerOutboxDispatcher неверен - повтор после таймаута дублирует
проводку, пауза между повторами не ждётся, хендлер напоминаний зарегистрирован синглтоном и держит
scoped-зависимости, в NotifyAsync перепутаны id клиента и счёта, из отмены удалена проверка статуса.
Без первых трёх пунктов мерджить нельзя, остальное - тоже до мерджа.
