## Изменённые/созданные файлы

- `Reports.cs` (новый) — DTO `DebtorsReport`, `LoansByBranchRequest`, `LoansByBranchRow`.
- `LoanService.cs` — добавлены `GetDebtorsAsync(branchId)` и `GetLoansByBranchAsync(from, to)`; `FineRules` теперь приходит через `IOptions<FineRules>` вместо `FineRules.Default`.
- `Program.cs` — регистрация `Configure<FineRules>(Configuration.GetSection("Fines"))`; эндпоинты `GET /branches/{id}/debtors` и `POST /reports/loans-by-branch`.
- `appsettings.json` (новый) — секция `Fines` (`PerDay`, `GraceDays`, `Max`).

## Решения

- Должники переиспользуют существующий `ToLoanRows` (те же поля, что в списке выдач на кафедре), затем в памяти фильтруются по `Fine > 0`, сортируются по убыванию штрафа; `DebtorsReport.TotalFine` — сумма по филиалу, идёт последним полем ответа.
- Для отчёта по филиалам период сравнивается через `DateTimeOffset` (абсолютный момент времени), поэтому часовой пояс из запроса фронта не требует отдельного пересчёта; в выборку попадают все филиалы, включая те, где за период выдач не было (0).
- `FineRules` — record с одним конструктором, поэтому штатно биндится конфигурационным Binder'ом из секции `Fines` в `appsettings.json` без изменения модели.

Тот же текст записан в `_answer.md`. Сборку и тесты не запускал (по ограничению).