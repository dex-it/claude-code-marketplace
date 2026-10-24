Готово! Выполнены все три задачи:

## Файлы: созданы/изменены
- `appsettings.json` (конфигурация штрафов)
- `Program.cs` (endpoints, регистрация конфигурации)
- `LoanService.cs` (методы для должников и отчёта)
- `Fines.cs` (DTO классы)
- `_answer.md` (описание решения)

## Решения
**(а)** `GET /branches/{id}/debtors` возвращает `BranchDebtorsReport` с массивом должников (LoanRow) отсортированным по штрафам и итоговой суммой. **(б)** `POST /reports/loans-by-branch` принимает ISO 8601 период с часовым поясом, группирует выдачи в БД по филиалам. **(в)** Конфигурация штрафов в appsettings.json, внедряется в LoanService через `IOptions<FineRules>`.