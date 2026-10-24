Готово. Изменённые/созданные файлы:

- `LoanService.cs` — `FineRules` теперь приходит через DI; добавлены `GetDebtorsAsync(branchId)` и `GetLoansByBranchAsync(from, to)`.
- `Reports.cs` (новый) — DTO `DebtorsReport`, `LoansByBranchRequest`, `BranchLoanCount`.
- `Program.cs` — `FineRules` читается из секции `Fines` конфигурации; добавлены эндпоинты `GET /branches/{id}/debtors` и `POST /reports/loans-by-branch`.
- `appsettings.json` (новый) — секция `Fines` (`PerDay`, `GraceDays`, `Max`).

Коротко о решениях: список должников переиспользует тот же `ToLoanRows`, что и на кафедре (сортировка по убыванию штрафа + `TotalFine` в конце JSON); отчёт по филиалам сравнивает `IssuedAt` (абсолютный момент) напрямую с `from`/`to` без пересчёта часовых поясов и включает все филиалы, даже с нулём выдач; штрафные параметры биндятся из `appsettings:Fines` с fallback на прежний `FineRules.Default`. Тот же текст записан в `_answer.md`.