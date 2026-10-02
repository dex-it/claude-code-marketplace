## Изменённые/созданные файлы

- `Reports.cs` (новый) — DTO: `DebtorsReport` (список должников + `TotalFine`), `LoansByBranchRow`, `LoansByBranchRequest`.
- `appsettings.json` (новый) — секция `Fines` (`PerDay`, `GraceDays`, `Max`) и `ConnectionStrings:Library`.
- `LoanService.cs` — `FineRules` теперь приходит через DI (не `FineRules.Default`); добавлены `GetDebtorsAsync(branchId)` и `GetLoansByBranchAsync(from, to)`.
- `Program.cs` — регистрация `FineRules` из конфигурации (fallback на `FineRules.Default`); endpoints `GET /branches/{id}/debtors` и `POST /reports/loans-by-branch`.

## Решения

- **(а)** Должники переиспользуют существующую проекцию `ToLoanRows` (тот же вид строки, что на кафедре), фильтр по филиалу/непогашенным займам/штрафу > 0 выполняется в SQL, сортировка по штрафу убывающая, сумма считается по уже материализованному (и так нужному целиком) списку.
- **(б)** Отчёт сделан как `LEFT JOIN` `Branches` → `Loans`, отфильтрованные по периоду `IssuedAt`, с `Count()` в SQL — так в отчёте попадают и филиалы без выдач. Сравнение идёт по `DateTimeOffset` (UTC-момент), поэтому часовой пояс запроса не искажает границы периода.
- **(в)** `PerDay/GraceDays/Max` вынесены в секцию `Fines` appsettings, биндятся в `FineRules` при старте и передаются в `LoanService` через DI.

Ответ также записан в `_answer.md`.