Изменённые/созданные файлы:
- `Fines.cs` — `FineRules` переведён на init-свойства с дефолтами (для биндинга конфигурации, `Default` убран); добавлены `DebtorsReport`, `LoansByBranchRequest`, `LoansByBranchRow`.
- `LoanService.cs` — `FineRules` теперь приходит через `IOptions<FineRules>`; добавлены `GetDebtorsAsync` (должники филиала) и `GetLoansByBranchAsync` (отчёт по периоду).
- `Program.cs` — регистрация `Configure<FineRules>(Configuration.GetSection("Fines"))`; эндпоинты `GET /branches/{id}/debtors` и `POST /reports/loans-by-branch`.
- `appsettings.json` (новый) — секция `Fines` (PerDay, GraceDays, Max).

Решения: фильтр «должник» (просрочка дольше льготного периода, не ребёнок) выражен в IQueryable через `DueDate`/`Category`, а не через `Fines.Amount` в `Where`, чтобы не фильтровать после материализации; список переиспользует `ToLoanRows`, сортировка по штрафу, общая сумма — отдельным полем по уже полученному списку. Период отчёта сравнивается как `DateTimeOffset` (`IssuedAt >= from && < to`), поэтому часовой пояс пользователя учитывается через сам момент времени без привязки к поясу филиала; группировка и `Count()` выполняются в БД.

Ответ также записан в `_answer.md`.