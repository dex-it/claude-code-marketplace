## Изменённые/созданные файлы

- `LoanService.cs` — изменён (DI-инъекция `FineRules` вместо `FineRules.Default`; добавлены `GetDebtorsAsync` и `GetLoansByBranchAsync`)
- `Fines.cs` — изменён (убран статический `FineRules.Default`, значения теперь только из конфигурации)
- `Reports.cs` — создан (DTO `DebtorsReport`, `LoansByBranchRow`, `LoansByBranchRequest`)
- `Program.cs` — изменён (биндинг `FineRules` из секции `Fines`, два новых endpoint'а: `GET /branches/{id}/debtors`, `POST /reports/loans-by-branch`)
- `appsettings.json` — создан (секция `Fines`: `PerDay`, `GraceDays`, `Max`)

## Решения

- Должники (а): переиспользован тот же `ToLoanRows` + фильтр `Fine > 0` поверх `IQueryable`, чтобы фильтрация и сортировка по убыванию штрафа остались в SQL; итоговая сумма — отдельным `SumAsync` по тому же запросу (агрегат считает БД, не C# после материализации).
- Отчёт по филиалам (б): `GroupJoin` филиалов с выдачами в периоде `[from, to)` по `IssuedAt` — в отчёте остаются и филиалы без выдач за период, счётчик считается в SQL; сравнение `DateTimeOffset` с присланными `from/to` корректно само по себе (нормализация к UTC), без ручных преобразований часовых поясов.
- Штрафы (в): `FineRules` — record, биндится из `appsettings.json` (секция `Fines`) через `IOptions<FineRules>` и регистрируется в DI как значение; `LoanService` получает его через конструктор.

Тот же текст записан в `_answer.md`.