Провёл ревью изменений MR !87. Ответ сохранён в `/home/mmx/.cache/research/runs/22eb6c/work/_answer.md`.

## Критические
1. **`BatchService.CompliancePercentAsync`** — `compliant / total * 100`: целочисленное деление выполняется до умножения, результат почти всегда 0 или 100 вместо реального процента.
2. **`BatchService.CompliancePercentAsync`** — деление на ноль (`DivideByZeroException`), если у партии нет проб (`total == 0`).

## Высокие
3. **`BatchService.CompliancePercentAsync`** — `s.Results.All(...)` на пустой коллекции результатов возвращает `true`, т.е. непроанализированные пробы ошибочно засчитываются как «в норме», искажая метрику для дашборда.
4. **`BatchService.ListAsync`** — off-by-one в пагинации: `Skip(page * pageSize)` при `page` начинающемся с 1 (по XML-doc) пропускает реальную первую страницу (самые новые партии из LAB-141 становятся недостижимы через заявленный контракт).

## Средние
5. **`BatchService.CloseAsync`** — нет проверки `ClosedAt != null`, повторный вызов молча перезатирает `ClosedAt`/`ReportDate`.
6. **`BatchService.RetagAsync`** — после `Trim()` пустые/пробельные теги не отфильтровываются и попадают в БД.

## Низкие
7. **`BatchService.PlanSampleAsync`** — нет проверки существования `siteId`, ошибка всплывает как FK-constraint exception.
8. **`LabDbContext`** — нет уникального индекса `(SampleId, Tag)` на `SampleTag`, дедупликация тегов обеспечивается только внутри одного вызова `RetagAsync`.
9. **`BatchService.CloseAsync`** — нет optimistic concurrency token на `Batch`, возможна гонка при параллельном закрытии одной партии.

Главное, что нужно исправить до мерджа — пункты 1–4 (сломанная метрика соответствия и неверная пагинация списка партий).