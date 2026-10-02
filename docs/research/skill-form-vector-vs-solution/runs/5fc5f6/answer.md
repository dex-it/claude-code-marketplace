Выполнено. Вот список изменений:

## Созданные/изменённые файлы

1. **Fines.cs** — добавлены `FineSettings` (конфигурируемый класс), `DebtorsResponse` и `BranchLoanStats` для DTO
2. **LoanService.cs** — конструктор принимает `FineRules` через DI; добавлены методы `GetDebtorsAsync()` (должники филиала, отсортированы по штрафам убывающе, с итогом) и `GetLoansByBranchAsync()` (число выдач по филиалам за период)
3. **Program.cs** — загрузка `FineSettings` из `appsettings.json` секции `Fines`; endpoints `GET /branches/{id}/debtors` и `POST /reports/loans-by-branch`
4. **appsettings.json** — создан с конфигурацией подключения и штрафов

## Решения

- Должники фильтруются в SQL (WHERE с проекцией LoanRow), сортировка по штрафам убывающе; итог вычислен в памяти
- Отчёт по выдачам группируется в SQL (GROUP BY с COUNT), клиент получает только итоги по филиалам
- Конфиг штрафов вынесен в appsettings, загружается при старте в DI-контейнер, передаётся в LoanService вместо Default