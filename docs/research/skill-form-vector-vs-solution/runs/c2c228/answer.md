Готово. Изменённые/созданные файлы:

- **Fines.cs** — добавлен `DebtorsReport` (список `LoanRow` + `TotalFine`); убран статический `FineRules.Default`.
- **Reports.cs** (новый) — DTO `LoansByBranchRow`.
- **LoanService.cs** — `FineRules` теперь приходит через `IOptions<FineRules>`; добавлены `GetDebtorsAsync` и `GetLoansByBranchAsync`.
- **Program.cs** — `Configure<FineRules>(Configuration.GetSection("Fines"))`, endpoints `GET /branches/{id}/debtors` и `POST /reports/loans-by-branch`, record `LoansByBranchRequest`.
- **appsettings.json** (новый) — секция `Fines` (PerDay, GraceDays, Max).

Решения: список должников переиспользует `ToLoanRows` (как на кафедре), фильтр/сортировка остаются на `IQueryable` до материализации, а сумма штрафов считается отдельным `SumAsync` (агрегат в SQL, не в памяти). Отчёт по филиалам сравнивает `IssuedAt` напрямую с присланными `DateTimeOffset` (абсолютный UTC-интервал), группировка и `Count()` — в SQL. То же самое записано в `_answer.md`.