Созданные/изменённые файлы:
- `Fines.cs` — убран хардкод `FineRules.Default`; добавлен `BranchDebtorsResponse(List<LoanRow> Debtors, decimal TotalFine)`.
- `LoanService.cs` — `FineRules` теперь приходит через `IOptions<FineRules>`; добавлен `GetDebtorsAsync(branchId)`.
- `ReportService.cs` (новый) — отчёт `LoansByBranchAsync(from, to)` + DTO.
- `Program.cs` — регистрация `ReportService`, биндинг `Fines` из конфигурации, эндпоинты `GET /branches/{id}/debtors` и `POST /reports/loans-by-branch`.
- `appsettings.json` (новый) — секция `Fines` и `ConnectionStrings:Library`.

Решения: должники переиспользуют формат `LoanRow` с кафедры (фильтр `Fine > 0`, сортировка по убыванию, сумма штрафов в конце); отчёт сравнивает `IssuedAt` напрямую с `From`/`To`, т.к. смещение пояса уже учтено во входных `DateTimeOffset`; `FineRules` как record с позиционным конструктором биндится из `IConfiguration` без отдельного класса опций.

Тот же текст записан в `_answer.md`. Сборку и тесты не запускал.