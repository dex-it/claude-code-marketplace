Изменённые/созданные файлы:
- `LoanService.cs` — изменён: `FineRules` теперь внедряется через `IOptions<FineRules>` вместо `FineRules.Default`; добавлен `GetDebtorsAsync(branchId)`.
- `Fines.cs` — изменён: убран хардкод `FineRules.Default`; добавлен `DebtorsReport` (список `LoanRow` + `TotalFines`).
- `ReportService.cs` — создан: `LoansByBranchAsync(from, to)` — количество выдач по каждому филиалу за период.
- `Program.cs` — изменён: регистрация `Configure<FineRules>` из секции `Fines`, `ReportService`; эндпоинты `GET /branches/{id}/debtors` и `POST /reports/loans-by-branch`.
- `appsettings.json` — создан: секция `Fines` (`PerDay`, `GraceDays`, `Max`) со старыми значениями 10/3/500.

Решения: для должников переиспользован формат `LoanRow` из списка выдач читателя, отфильтрован по `Fine > 0` и отсортирован по убыванию штрафа с итоговой суммой. Период отчёта сравнивается с `IssuedAt` как абсолютный момент времени (`DateTimeOffset`), поэтому часовой пояс фронта не важен; `to` не включается, в отчёт попадают все филиалы, даже без выдач. `FineRules` биндится из `appsettings.json` через `IOptions<FineRules>` (конструкторный биндинг конфигурации к record).

Тот же текст сохранён в `_answer.md`.