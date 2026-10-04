Отлично! Все задачи выполнены. Вот итоговый список:

## Созданные/изменённые файлы

1. **appsettings.json** - конфигурация штрафов (PerDay: 10, GraceDays: 3, Max: 500)
2. **Program.cs** - добавлены endpoints `/branches/{id}/debtors` и `/reports/loans-by-branch`, регистрация FinesConfig
3. **Fines.cs** - классы FinesConfig, DebtorsReport, LoansByBranchRow, конструктор FineRules из конфига
4. **LoanService.cs** - использование конфигурации через IOptions, методы GetDebtorsAsync и GetLoansByBranchAsync

## Решения

**(а)** GET `/branches/{id}/debtors` возвращает должников филиала (активные просроченные выдачи), отсортированные по штрафу (убывание), с объектом DebtorsReport содержащим список и итоговую сумму.

**(б)** POST `/reports/loans-by-branch` принимает period с from/to (ISO 8601 DateTimeOffset), возвращает список филиалов с counts выданных книг за период.

**(в)** Параметры штрафа вынесены в appsettings.json (Fines: {PerDay, GraceDays, Max}), загружаются через IOptions<FinesConfig> в конструктор LoanService.