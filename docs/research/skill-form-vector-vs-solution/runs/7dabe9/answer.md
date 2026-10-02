## Изменённые/созданные файлы

- `LoanService.cs` — конструктор теперь принимает `FineRules` из DI; добавлен метод `GetDebtorsAsync(branchId)`.
- `Fines.cs` — добавлен `DebtorsResponse` (список `LoanRow` + `TotalFine`).
- `ReportService.cs` (новый) — `LoansByBranchRequest`, `BranchLoanCount`, метод `GetLoansByBranchAsync(from, to)`.
- `Program.cs` — чтение `FineRules` из секции `Fines`, регистрация `ReportService`, эндпоинты `GET /branches/{id}/debtors` и `POST /reports/loans-by-branch`.
- `appsettings.json` (новый) — секция `Fines` (`PerDay`, `GraceDays`, `Max`).

## Решения

Должники переиспользуют `LoanRow`/`ToLoanRows` (тот же формат, что на кафедре), фильтрация и сортировка по штрафу — в памяти, как и в существующем `GetActiveLoansAsync`. Отчёт сравнивает `from`/`to` напрямую как `DateTimeOffset` с `IssuedAt` (сравнение абсолютных моментов, часовой пояс отправителя не важен) и включает все филиалы, даже с нулём выдач. `FineRules` биндится из `Fines` через конструкторный биндинг конфигурации и регистрируется как singleton, с fallback на `FineRules.Default`.

Тот же текст записан в `_answer.md`.