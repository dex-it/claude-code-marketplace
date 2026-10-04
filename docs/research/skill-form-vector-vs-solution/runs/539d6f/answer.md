Готово. Изменённые/созданные файлы:

- **Fines.cs** — убран хардкод `FineRules.Default`; добавлены `ToDebtorRows` (переиспользует `ToLoanRows`, фильтр `Fine > 0`) и `DebtorsResponse`.
- **LoanService.cs** — `FineRules` теперь приходит через `IOptions<FineRules>`; добавлены `GetDebtorsAsync` и `GetLoansByBranchAsync`.
- **Reports.cs** (новый) — `LoansByBranchRequest` и `BranchLoanCount`.
- **Program.cs** — регистрация `IOptions<FineRules>` из секции `Fines`, эндпоинты `GET /branches/{id}/debtors` и `POST /reports/loans-by-branch`.
- **appsettings.json** (новый) — секция `Fines` (PerDay/GraceDays/Max).

Решения: должники используют ту же проекцию строк, что и список выдач на кафедре, а сортировка/сумма штрафов считаются в БД отдельным агрегатным запросом, не над уже загруженной коллекцией. Отчёт по филиалам сравнивает `DateTimeOffset` из запроса напрямую с `timestamptz`-колонкой (сравнение по абсолютному моменту, часовой пояс запроса значения не меняет) и считает число выдач коррелированным `Count` одним SQL-запросом, включая филиалы без выдач. Тот же ответ записан в `_answer.md`.