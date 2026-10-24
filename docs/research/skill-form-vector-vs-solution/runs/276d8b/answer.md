## Изменённые/созданные файлы

- `Fines.cs` — добавлен `DebtorsReport(List<LoanRow> Debtors, decimal TotalFine)`.
- `LoanService.cs` — `FineRules` теперь приходит через DI (не `FineRules.Default`); добавлен `GetDebtorsAsync(branchId)`.
- `ReportService.cs` (новый) — `LoansByBranchAsync(from, to)` и DTO `LoansByBranchRequest`, `BranchLoanCount`.
- `Program.cs` — регистрация `FineRules` из конфигурации (секция `Fines`), регистрация `ReportService`, два новых эндпоинта: `GET /branches/{id}/debtors`, `POST /reports/loans-by-branch`.
- `appsettings.json` (новый) — секция `Fines` (`PerDay`, `GraceDays`, `Max`); файла ранее в проекте не было.

## Решения

- Должники — непогашенные выдачи филиала с `DueDate < "сегодня" филиала` (учитывается пояс филиала), переиспользован `ToLoanRows`, сортировка по штрафу по убыванию; итоговая сумма — отдельное поле `TotalFine`, а не фиктивная строка в массиве.
- `from`/`to` биндятся как `DateTimeOffset`, сравниваются с `IssuedAt` по абсолютному моменту — пересчёт в пояс филиала не нужен; отчёт строится от списка филиалов, чтобы филиалы без выдач попадали в отчёт с нулём.
- `FineRules` собирается в DI-синглтон явным чтением `GetValue<T>` из секции `Fines`, без `IOptions`-биндинга записи с конструктором — надёжнее, чем полагаться на constructor-binding конфигурации.

Тот же текст записан в `_answer.md`.