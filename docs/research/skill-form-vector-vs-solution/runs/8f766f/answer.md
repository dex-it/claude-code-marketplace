## Итоги ревью MR !87

**Critical**
1. `BatchService.CompliancePercentAsync` — `compliant / total * 100`: целочисленное деление выполняется раньше умножения, результат почти всегда 0% вместо реального процента.
2. `BatchService.CompliancePercentAsync` — деление на ноль при `total == 0` (партия без проб).

**High**
3. `BatchService.CompliancePercentAsync` — `Results.All(...)` на пустой коллекции результатов истинно вакуумно, пробы без результатов засчитываются как "соответствующие норме".
4. `BatchService.ListAsync` — `Skip(page * pageSize)` при нумерации страниц с 1 пропускает первую страницу целиком и сдвигает всю пагинацию.
5. `BatchService.CloseAsync` / `SampleRepository.GetInAnalysisForBatchAsync` — проверка "нет проб без результатов" и перевод в `Done` затрагивают только пробы со статусом `InAnalysis`; пробы партии в статусах `Planned`/`Collected` не проверяются и остаются незавершёнными после закрытия.

**Medium**
6. `BatchService.CloseAsync` — гонка "читай-потом-пиши" без транзакции/токена конкурентности между проверкой результатов и записью статусов.
7. `BatchService.RetagAsync` — нет защиты от конкурентной правки одной пробы (последняя запись молча перетирает предыдущую).
8. `BatchService.GetCardAsync`/`BatchCard` — новое поле `Batch.ReportDate` не выведено в карточке партии, хотя именно для него добавлено.

**Low**
9. `SampleRepository.GetRecentBySiteAsync` — тянет полную сущность `Sample` (`SELECT s.*`), хотя для карточки объекта, вероятно, нужны только несколько полей.
10. Не подтверждено наличие EF-миграции для новых полей/индексов (`PlannedLocal`, `ReportDate`, `SampleTag`) и способ её применения на prod.

Полный разбор с пояснениями записан в `/home/mmx/.cache/research/runs/8f766f/work/_answer.md`.