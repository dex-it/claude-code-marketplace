Ревью проведено, ответ записан в `_answer.md`. Основные находки:

**Критично/блокирует мердж:**
1. `BatchService.CompliancePercentAsync` — целочисленное деление `compliant / total * 100` даёт почти всегда 0% или 100% вместо реального процента (**critical**, LAB-147).
2. Там же — `DivideByZeroException` при пустой партии (`total == 0`) (**high**).
3. `BatchService.ListAsync` — `Skip(page * pageSize)` вместо `Skip((page-1)*pageSize)`: при документированной нумерации страниц с 1 первая страница партий теряется навсегда (**high**, LAB-141).

**Стоит исправить/обсудить:**
4. `CompliancePercentAsync` считает пробу без единого результата «соответствующей норме» (vacuous truth на `All`) — завышает процент (**medium**).
5. `CloseAsync` не проверяет, что партия уже закрыта — повторный вызов молча перезаписывает `ClosedAt`/`ReportDate` (**medium**).
6. `CloseAsync` валидирует и переводит в `Done` только пробы со статусом `InAnalysis`, игнорируя пробы в `Planned`/`Collected` — партия может закрыться с незавершёнными пробами внутри (**medium**).
7. `SampleRepository.GetRecentBySiteAsync` — граница `UtcNow.Date.AddDays(-days)` фактически возвращает N+1 суток (**low**).

SQL-инъекций в `FromSql` нет (параметризовано через интерполяцию), маппинг `snake_case` и связи в `LabDbContext` выглядят корректно.