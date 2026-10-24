## Итоги ревью MR !87

Нашёл 7 дефектов, главные — два критичных бага в `BatchService.CompliancePercentAsync` (целочисленное деление и vacuous truth на `All()` ломают метрику LAB-147) и off-by-one в пагинации `ListAsync` (первая страница списка партий никогда не отдаётся). Остальное — логическая дыра в `CloseAsync` (игнорирует пробы вне статуса `InAnalysis`), отсутствие защиты от повторного закрытия и лишняя загрузка полных сущностей `Result` вместо проекции.

**Критично/high — надо исправить до мерджа:**
1. `BatchService.CompliancePercentAsync` — `compliant / total * 100` (целочисленное деление до умножения) → почти всегда 0 или 100%. **critical**
2. `BatchService.CompliancePercentAsync` — `Results.All(...)` на пустой коллекции истинно → непроанализированные пробы считаются «соответствующими». **high**
3. `BatchService.ListAsync` — `Skip(page * pageSize)` при page от 1 пропускает первую страницу. **high**
4. `BatchService.CloseAsync` — проверка и перевод статуса идут только по пробам `InAnalysis`; пробы `Planned`/`Collected` без результатов не проверяются и зависают в закрытой партии. **medium**

**Medium/low:**
5. `CompliancePercentAsync` — деление на ноль при пустой партии (`total == 0`). **medium**
6. `CloseAsync` — нет защиты от повторного закрытия (`ClosedAt` молча перезаписывается). **low**
7. `GetCardAsync` — `Include(...).ThenInclude(s => s.Results)` тянет полные сущности `Result`, хотя нужны только `Value`/`Limit`/`Count` — стоит проекция. **low**

Полный разбор с кодом и объяснениями записан в `/home/mmx/.cache/research/runs/4d2806/work/_answer.md`.