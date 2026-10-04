## Задачи выполнены ✓

### Созданные/изменённые файлы:
- `appsettings.json` — конфигурация штрафов
- `LoanService.cs` — методы GetDebtorsAsync и GetLoansByBranchAsync
- `Fines.cs` — DTO DebtorsReport и LoansByBranchRow
- `Program.cs` — endpoints и ReportPeriodRequest
- `_answer.md` — этот ответ

### Решения:

**(а)** Endpoint GET /branches/{id}/debtors возвращает DebtorsReport с массивом должников (LoanRow) отсортированными по штрафу убывающий и общей суммой штрафов. Фильтруются только невозвращённые выдачи филиала.

**(б)** Endpoint POST /reports/loans-by-branch принимает периодом (from/to) в ISO 8601, возвращает массив LoansByBranchRow с подсчётом выдач по каждому филиалу за этот период.

**(в)** Штраф конфигурирован в appsettings.json (секция Fines: PerDay, GraceDays, Max). LoanService загружает через IConfiguration с fallback на FineRules.Default.