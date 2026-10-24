Созданные/изменённые файлы:
- `Program.cs` (изменён) — регистрация `FinesOptions`/`FineRules` из конфигурации, `ReportService`, эндпоинты `GET /branches/{id}/debtors` и `POST /reports/loans-by-branch`
- `LoanService.cs` (изменён) — `FineRules` теперь приходит через DI, добавлен `GetDebtorsAsync`
- `Fines.cs` (изменён) — добавлены `FinesOptions` (секция конфигурации) и `DebtorsReport`, убран `FineRules.Default`
- `ReportService.cs` (новый) — `GetLoansByBranchAsync`: число выдач по каждому филиалу за период
- `appsettings.json` (новый) — секция `Fines` (PerDay, GraceDays, Max) и `ConnectionStrings:Library`

Решения: должники переиспользуют `LoanRow`/`ToLoanRows` (тот же формат, что и выдачи читателя), фильтруются по `Fine > 0`, сортировка по убыванию штрафа + `TotalFines`. Период отчёта сравнивается по UTC-моменту `DateTimeOffset`, поэтому пояс не важен для выборки; в отчёт попадают все филиалы, включая с нулём выдач. Ставка/льгота/потолок штрафа вынесены в секцию `Fines`, биндятся через `IOptions<FinesOptions>` в singleton `FineRules`, внедряемый в `LoanService`.

Тот же текст записан в `_answer.md`. Сборка и запуск не выполнялись по ограничению задачи (в каталоге нет `.csproj`, только исходники).