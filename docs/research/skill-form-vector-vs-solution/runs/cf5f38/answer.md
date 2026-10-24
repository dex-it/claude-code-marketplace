Решение готово! Реализованы все три задачи:

**Созданы/изменены:**
1. **appsettings.json** — конфигурация штрафов (ставка 10/день, льгота 3 дня, потолок 500)
2. **Program.cs** — endpoints, загрузка конфигурации, регистрация LoanService
3. **LoanService.cs** — методы GetDebtorsAsync() и GetLoansByBranchReportAsync()
4. **Fines.cs** — DTOs DebtorsReport и LoansByBranchRow

**(а)** GET `/branches/{id}/debtors` возвращает должников филиала с читателем, телефоном, книгой, сроком, днями просрочки и штрафом; отсортированы по штрафу (убыв.), в конце — общая сумма.

**(б)** POST `/reports/loans-by-branch` принимает период (ISO 8601 с часовым поясом в теле: `{"from": "...", "to": "..."}`) и возвращает кол-во выдач по филиалам.

**(в)** Параметры штрафа вынесены в `appsettings.json` (секция Fines), загружаются при старте и передаются в LoanService через конструктор.

Ответ записан в `/home/mmx/.cache/research/runs/cf5f38/work/_answer.md`.