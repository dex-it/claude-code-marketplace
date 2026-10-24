## Изменённые/созданные файлы

- `LoanService.cs` — конструктор принимает `FineRules` через DI; добавлены `GetDebtorsAsync(branchId)` и `GetLoansByBranchAsync(from, to)`.
- `Program.cs` — `FineRules` биндится из секции `Fines`; добавлены эндпоинты `GET /branches/{id}/debtors` и `POST /reports/loans-by-branch`; добавлен record `LoansByBranchRequest`.
- `Fines.cs` — убран захардкоженный `FineRules.Default`; добавлен `DebtorsReport` (список должников + `TotalFines`).
- `Reports.cs` (новый) — `LoansByBranchRow` (филиал + число выдач за период).
- `appsettings.json` (новый) — секция `Fines` (`PerDay`, `GraceDays`, `Max`).

## Решения

- Список должников переиспользует существующую проекцию `ToLoanRows`/`LoanRow` (как на кафедре), фильтруя незакрытые просроченные выдачи филиала; сортировка по убыванию штрафа, общая сумма — в `DebtorsReport.TotalFines`.
- Отчёт по выдачам строится через `Branches LEFT JOIN Loans`, чтобы попадали все филиалы, включая те, где за период выдач не было; период сравнивается напрямую по `DateTimeOffset`, что корректно независимо от часовых поясов филиала и пользователя.
- `FineRules` стал конфигурируемым через секцию `Fines` в `appsettings.json` (биндинг в DI через конструктор record), вместо хардкода в коде.

Тот же текст записан в `_answer.md`.