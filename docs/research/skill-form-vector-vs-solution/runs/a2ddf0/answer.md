## Изменённые/созданные файлы

- `LoanService.cs` — изменён: `FineRules` теперь приходит через DI-конструктор; добавлены `GetDebtorsAsync(branchId)` (GET /branches/{id}/debtors) и `GetLoansByBranchAsync(from, to)` (POST /reports/loans-by-branch).
- `Fines.cs` — изменён: убран хардкод `FineRules.Default`, правила теперь только из конфигурации.
- `Program.cs` — изменён: `FineRules` биндится из секции `Fines` конфигурации и регистрируется как singleton; добавлены два новых эндпоинта и `LoansByBranchRequest`.
- `Reports.cs` — создан: DTO `DebtorsReport` (Debtors + TotalFines) и `LoansByBranchRow`.
- `appsettings.json` — создан: секция `Fines` (PerDay/GraceDays/Max) и `ConnectionStrings:Library`.

## Решения

- (а) Переиспользован существующий `ToLoanRows` (тот же состав полей, что и в списке на кафедре). Условия `BranchId/ReturnedAt/DueDate` уходят в SQL-WHERE; штраф считается нетранслируемым `Fines.Amount` в финальном Select, поэтому фильтр `Fine > 0` и сортировка по убыванию штрафа выполняются уже на материализованной (сужённой) выборке — по правилу SKILL.md про нетранслируемое условие. Сумма по филиалу — отдельное поле `TotalFines` в ответе.
- (б) Период — пара `DateTimeOffset` (абсолютные моменты с оффсетом), поэтому сравнение с `IssuedAt` (timestamptz) не требует конвертации по поясу филиала. Количество выдач на филиал считается одним SQL-запросом через коррелированный `Count` в проекции по всем филиалам (агрегат в БД, а не в цикле).
- (в) `FineRules` вынесены в `appsettings.json`, секция `Fines`; читаются через `IConfiguration.Get<FineRules>()` (биндинг record'а через конструктор) и регистрируются как singleton.