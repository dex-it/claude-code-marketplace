Изменённые/созданные файлы:
- `Fines.cs` — добавлен `DebtorsResponse` (Items + TotalFine).
- `LoanService.cs` — `FineRules` теперь из DI-конструктора; добавлен `GetDebtorsAsync(branchId)` для GET `/branches/{id}/debtors`.
- `ReportService.cs` (новый) — `GetLoansByBranchAsync(from, to)` для POST `/reports/loans-by-branch`.
- `Program.cs` — регистрация `FineRules` из конфигурации и `ReportService` в DI, два новых эндпоинта.
- `appsettings.json` (новый) — секция `Fines` (PerDay, GraceDays, Max).

Решения: список должников переиспользует существующие `ToLoanRows`/`LoanRow` (та же проекция, что на кафедре), фильтр и сортировка по штрафу — в SQL, сумма — в памяти над уже полученным списком. В отчёте `IssuedAt` сравнивается как `DateTimeOffset` (timestamptz) по абсолютному моменту, поэтому присланный пользовательский часовой пояс не требует конвертации; группировка/Count — в SQL. `FineRules` биндится из секции `Fines` и регистрируется singleton, с fallback на `FineRules.Default`.