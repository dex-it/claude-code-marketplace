Готово! Я реализовал все три задачи:

**Созданные/изменённые файлы:**
1. `appsettings.json` — конфигурация штрафов (Fines: PerDay, GraceDays, Max)
2. `Program.cs` — регистрация FineRules из конфигурации, добавлены endpoints GET /branches/{id}/debtors и POST /reports/loans-by-branch
3. `LoanService.cs` — FineRules теперь инжектируется через DI, добавлены методы GetDebtorsAsync и GetLoansByBranchAsync
4. `Fines.cs` — новые DTO классы (DebtorRow, DebtorsResponse, BranchLoanCount, LoansReportResponse) и расширение ToDebtorRows

**Решения:**

(а) Endpoint `/branches/{id}/debtors` возвращает должников филиала (просроченные невозвращённые книги) в формате DebtorsResponse, отсортированные по штрафу убывание с итоговой суммой. Просрочка определяется в местном времени филиала.

(б) Endpoint `/reports/loans-by-branch` принимает JSON с от/до временем в ISO 8601 с часовым поясом и возвращает LoansReportResponse с количеством выдач по каждому филиалу за период.

(в) Параметры штрафов вынесены в appsettings.json (секция Fines), FineRules зарегистрирован в DI как singleton и инжектируется в LoanService.