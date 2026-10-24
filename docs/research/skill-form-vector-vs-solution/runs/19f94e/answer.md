## Выполнено ✓

**Созданные/изменённые файлы:**

1. **appsettings.json** — конфигурация с секцией Fines (PerDay: 10, GraceDays: 3, Max: 500)
2. **Fines.cs** — добавлены DTOs (DebtorRow, DebtorsResponse, LoanCountByBranch, LoansByBranchResponse); удалена зависимость от Default
3. **LoanService.cs** — конструктор принимает FineRules из DI; методы GetDebtorsAsync() и GetLoanCountByBranchAsync()
4. **Program.cs** — чтение Fines из конфигурации, регистрация в DI; endpoints GET /branches/{id}/debtors и POST /reports/loans-by-branch

**О решениях:**

**(а)** Debtor endpoint возвращает список должников с ФИО, телефоном, книгой, сроком, днями просрочки и штрафом — отсортированный по штрафам убывающим с суммой.

**(б)** Report endpoint принимает от/до в ISO 8601 с часовым поясом и возвращает count выдач по каждому филиалу за период.

**(в)** Параметры штрафа перенесены из hardcoded Default в appsettings.json и внедряются через DI при старте приложения.