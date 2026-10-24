Готово! Все три задачи реализованы:

**Созданные/изменённые файлы:**
1. **appsettings.json** — конфигурация штрафов (PerDay: 10, GraceDays: 3, Max: 500)
2. **Program.cs** — инъекция FineRules из конфигурации, два новых endpoint
3. **LoanService.cs** — конструктор принимает FineRules, методы GetDebtorsAsync и GetLoansByBranchAsync
4. **Fines.cs** — классы DebtorRow, DebtorsReport, LoansByBranchRow, LoansByBranchReport

**Решения:** (а) GET /branches/{id}/debtors возвращает должников с активными просроченными книгами, отсортированных по штрафам (больше вверху) с итоговой суммой; (б) POST /reports/loans-by-branch принимает период в ISO 8601 с часовым поясом и возвращает число выдач по филиалам за этот период; (в) параметры штрафов вынесены в appsettings.json и внедряются в LoanService, сохраняя обратную совместимость с Default.