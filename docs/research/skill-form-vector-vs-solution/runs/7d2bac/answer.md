Изменённые/созданные файлы:
- `Program.cs` — изменён: `FineRules` регистрируется в DI из секции `Fines` конфигурации; добавлены endpoint'ы `GET /branches/{id}/debtors` и `POST /reports/loans-by-branch`.
- `LoanService.cs` — изменён: `FineRules` теперь приходит через конструктор (DI); добавлены `GetDebtorsAsync(branchId)` и `GetLoansByBranchAsync(from, to)`.
- `Fines.cs` — изменён: убрано неиспользуемое `FineRules.Default`; добавлен DTO `DebtorsReport`.
- `Reports.cs` — новый: DTO `LoansByBranchRequest` и `BranchLoanCount`.
- `appsettings.json` — новый: секция `Fines` (PerDay, GraceDays, Max).

Решения: должники переиспользуют тот же `ToLoanRows`, что и список выдач на кафедре, с условием просрочки целиком в `IQueryable` (транслируется в SQL), сортировкой по убыванию штрафа и суммой по филиалу; отчёт по филиалам сделан через `GroupJoin` с `Branches`, чтобы в него попадали и филиалы без выдач за период, а сравнение идёт по абсолютному `IssuedAt`, поэтому часовой пояс из присланного ISO 8601 учитывается автоматически; параметры штрафа вынесены в `FineRules`, собираемый в `Program.cs` из секции `Fines`.