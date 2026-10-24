Готово. Изменённые/созданные файлы:

- `Fines.cs` — добавлен `DebtorsReport(Items, TotalFine)`.
- `LoanService.cs` — `FineRules` теперь приходит через DI (не хардкод); добавлен `GetDebtorsAsync(branchId)`.
- `Reports.cs` (новый) — `ReportService.GetLoansByBranchAsync`, DTO `LoansByBranchRequest`, `BranchLoanCount`.
- `Program.cs` — биндинг секции `Fines` в `FineRules`, регистрация `ReportService`, эндпоинты `GET /branches/{id}/debtors` и `POST /reports/loans-by-branch`.
- `appsettings.json` (новый) — секция `Fines` (PerDay, GraceDays, Max).

Решения: (а) должники — та же проекция `LoanRow`, что и на кафедре, фильтр по незакрытым просроченным выдачам филиала, сортировка по убыванию штрафа и сумма штрафов считаются в БД (две выборки по одному `IQueryable`, без клиентской агрегации); (б) период сравнивается как `DateTimeOffset` с `IssuedAt` напрямую (офсет не важен — сравнение по UTC-моменту), количество выдач — коррелированный подзапрос в БД, филиалы без выдач попадают в отчёт с нулём; (в) `FineRules` теперь биндится из конфигурации и внедряется через DI вместо `FineRules.Default`.

Тот же текст записан в `_answer.md`.