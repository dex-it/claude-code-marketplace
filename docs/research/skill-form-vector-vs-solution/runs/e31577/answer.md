## Выполнено ✓

Реализовал все три задачи для сервиса BookQuarter.Library:

### Созданные/изменённые файлы:
- **appsettings.json** (создан) — конфигурация штрафов
- **LoanService.cs** (изменён) — методы GetDebtorsAsync(), GetLoansCountByBranchAsync(); конструктор читает FineRules из configuration
- **Fines.cs** (изменён) — типы DebtorReportRow, LoansCountRow
- **Program.cs** (изменён) — endpoints GET /branches/{id}/debtors и POST /reports/loans-by-branch
- **_answer.md** (создан) — документация

### Решения:

**(а)** Endpoint GET /branches/{id}/debtors возвращает должников филиала с просрочкой (отфильтрованы по условию `DaysOverdue > 0`), отсортированных по размеру штрафа (большие первыми), с общей суммой штрафов; используется существующая структура LoanRow.

**(б)** Endpoint POST /reports/loans-by-branch принимает PeriodRequest с временами в ISO 8601, возвращает список выдач по филиалам за период, группируя по BranchId и считая количество.

**(в)** Конфигурация штрафов (PerDay=10, GraceDays=3, Max=500) вынесена в appsettings.json и читается через IConfiguration в конструкторе LoanService, заменив FineRules.Default.