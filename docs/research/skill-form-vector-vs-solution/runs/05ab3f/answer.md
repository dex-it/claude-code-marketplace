## Готово! Выполнены все три поручения:

**Созданные/изменённые файлы:**
1. **appsettings.json** (создан)
2. **LoanService.cs** (изменён)
3. **Fines.cs** (изменён)
4. **Program.cs** (изменён)

**Решение:**
- **(a)** GET /branches/{id}/debtors возвращает DebtorsReport с отсортированным по штрафам (убывание) списком просроченных выдач и суммой штрафов филиала.
- **(б)** POST /reports/loans-by-branch принимает JSON с from/to в ISO 8601 с часовым поясом, возвращает массив LoansByBranchRow с числом выдач по филиалам за период.
- **(в)** Параметры штрафов (PerDay, GraceDays, Max) вынесены в appsettings.json секцию Fines; LoanService читает конфигурацию через IConfiguration.

Результат записан в _answer.md.