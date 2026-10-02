Изменённые/созданные файлы:
- `Fines.cs` — добавлен `DebtorsReport(Debtors, TotalFine)`.
- `LoanService.cs` — `FineRules` внедряется через DI; добавлены `GetDebtorsAsync` и `GetLoansByBranchAsync`.
- `Reports.cs` (новый) — DTO для отчёта по филиалам.
- `Program.cs` — регистрация `FineRules` из конфигурации, endpoints `GET /branches/{id}/debtors` и `POST /reports/loans-by-branch`.
- `appsettings.json` (новый) — секция `Fines` (PerDay, GraceDays, Max).

Решения: должники переиспользуют `LoanRow`/`ToLoanRows` (те же поля, что и на кафедре), фильтр `Fine > 0` и сортировка — в IQueryable, сумма — на уже полученном для вывода списке. Период отчёта сравнивается как `DateTimeOffset` по абсолютному моменту, поэтому пользовательский часовой пояс учитывается автоматически. Ставки штрафа вынесены в `appsettings.json:Fines` и биндятся в `FineRules` при старте, со `FineRules.Default` как запасным значением.