Изменённые/созданные файлы:
- `Fines.cs` — добавлены `DebtorsReport`, `BranchLoanCount`; `FineRules` упрощён (убран `Default`).
- `LoanService.cs` — `FineRules` теперь внедряется через конструктор; добавлены `GetDebtorsAsync` и `GetLoansByBranchReportAsync`.
- `Program.cs` — чтение `FineRules` из секции `Fines` конфигурации, регистрация singleton; два новых эндпоинта: `GET /branches/{id}/debtors`, `POST /reports/loans-by-branch`.
- `appsettings.json` (новый) — секция `Fines` (`PerDay`, `GraceDays`, `Max`).

Решения: должники переиспользуют `ToLoanRows` (тот же формат строки, что в списке выдач), фильтр/сортировка — до материализации, сумма штрафов считается отдельным `SumAsync` по тому же запросу (не постфактум над списком). Отчёт по филиалам сравнивает `DateTimeOffset` как абсолютные моменты (смещение из запроса не важно) и через `GroupJoin` показывает и филиалы с нулём выдач. `FineRules` биндится из конфигурации конструкторным биндингом .NET 8 — без parameterless-конструктора и мутабельных сеттеров.