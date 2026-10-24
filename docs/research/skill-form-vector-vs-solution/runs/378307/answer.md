Готово! Выполнил все три задачи.

**Созданные/изменённые файлы:**
- `appsettings.json` (создан) — конфигурация штрафов (Fines: PerDay, GraceDays, Max)
- `LoanService.cs` (изменён) — инжекция IConfiguration, методы GetDebtorsAsync() и GetLoansByBranchReportAsync()
- `Fines.cs` (изменён) — DTO классы DebtorRow, DebtorsReport, BranchLoansReport
- `Program.cs` (изменён) — endpoints GET /branches/{id}/debtors и POST /reports/loans-by-branch

**Решения:**

**(а)** Endpoint `/branches/{id}/debtors` выполняет no-tracking запрос с проекцией в DTO, отфильтрует активные выдачи, сортирует по штрафу (убывание) и возвращает массив должников + итоговую сумму штрафов.

**(б)** Endpoint `/reports/loans-by-branch` парсит ISO 8601 периоды с часовым поясом, конвертирует в UTC, в SQL группирует по филиалам с COUNT() и возвращает число выдач за период.

**(в)** Параметры штрафа вынесены в `appsettings.json` → `Fines`; LoanService инжектирует `IConfiguration` и парсит значения при создании `FineRules`.