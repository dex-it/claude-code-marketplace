Готово. Изменённые/созданные файлы:

- `Fines.cs` — убран хардкод `FineRules.Default`; добавлены `DebtorsResponse` и `LoansByBranchRow`
- `LoanService.cs` — `FineRules` теперь берётся из `IOptions<FineRules>`; добавлены `GetDebtorsAsync` и `GetLoansByBranchAsync`
- `Program.cs` — регистрация `Configure<FineRules>(...)`; endpoints `GET /branches/{id}/debtors` и `POST /reports/loans-by-branch`
- `appsettings.json` (новый) — секция `Fines` и `ConnectionStrings:Library`

Должники переиспользуют ту же проекцию `ToLoanRows`, что и список выдач на кафедре: транслируемые фильтры (филиал, непогашенные выдачи) идут в SQL, а фильтр по `Fine > 0` и сортировка по штрафу — после материализации, так как сам штраф считается C#-методом, не транслируемым EF. Отчёт по филиалам — через подзапрос `COUNT` на каждый `Branch`, чтобы попадали и филиалы без выдач за период. Ставка/льгота/потолок штрафа теперь читаются из секции `Fines` конфигурации.

Тот же текст записан в `_answer.md`.