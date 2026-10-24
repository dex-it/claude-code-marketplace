Отлично! Я выполнил все три поручения:

**Созданные/изменённые файлы:**
- `appsettings.json` — конфиг с секцией Fines (PerDay, GraceDays, Max)
- `Debtors.cs` — типы DebtorRow, DebtorsResponse
- `Reports.cs` — типы для отчёта (LoansReportRequest, LoansReportItem, LoansReport)
- `LoanService.cs` — получение конфига из IConfiguration в конструкторе; методы GetDebtorsAsync и GetLoansReportAsync
- `Program.cs` — endpoints GET /branches/{id}/debtors и POST /reports/loans-by-branch
- `_answer.md` — описание решений

**Решения:**
- **(а)** Невозвращённые выдачи с просрочкой загружаются Include, вычисления штрафов в памяти (LINQ не может трансдировать Fines.Amount), сортировка по штрафу descending, итоговая сумма.
- **(б)** GROUP BY (BranchId, Name) в LINQ для подсчёта выдач за период [From, To] по IssuedAt.
- **(в)** Конфиг вынесен в appsettings.json, LoanService читает через IConfiguration в конструкторе.