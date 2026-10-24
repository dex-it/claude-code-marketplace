Работа готова. Реализованы все три задачи:

## Созданные/изменённые файлы

1. **appsettings.json** — конфигурация штрафов
2. **Program.cs** — endpoints GET /branches/{id}/debtors и POST /reports/loans-by-branch с DTOs
3. **LoanService.cs** — методы GetDebtorsAsync и GetLoansByBranchAsync, внедрение конфигурации

## Решения

(a) **GetDebtorsAsync** загружает просроченные выдачи (ReturnedAt == null, DueDate < сегодня), сортирует по штрафу убывание, возвращает список + сумму. Include предотвращает N+1 запросов; материализация (ToListAsync) перед сортировкой, так как расчёт штрафа не транслируется в SQL.

(б) **GetLoansByBranchAsync** группирует выдачи по филиалу и периоду (DateTimeOffset поддерживает UTC и часовые пояса нативно), агрегирует в БД до материализации согласно SKILL.md rule 9.

(в) Штраф, льготный период и потолок в appsettings→Fines; LoanService читает конфигурацию в конструкторе с fallback на старые дефолты.