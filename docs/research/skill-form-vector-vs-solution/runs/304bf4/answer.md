Провёл ревью MR !87, ответ сохранён в `/home/mmx/.cache/research/runs/304bf4/work/_answer.md`.

# Ревью MR !87 — Партии проб

## Критичные / высокие дефекты

**1. `BatchService.cs` — `CompliancePercentAsync` — critical**
`return compliant / total * 100;` — деление на ноль при пустой партии (`DivideByZeroException`) и целочисленное деление, выполняемое раньше умножения (теряется дробная часть, например 1/3 даёт 0% вместо 33%).

**2. `BatchService.cs` — `CompliancePercentAsync` — high**
`s.Results.All(r => r.Value <= r.Limit)` на пустой коллекции результатов истинно по умолчанию — пробы без единого результата засчитываются «в норме», искажая метрику дашборда (LAB-147).

**3. `BatchService.cs` — `ListAsync` — high**
Доккомментарий объявляет страницы с 1, но `.Skip(page * pageSize)` вместо `.Skip((page - 1) * pageSize)` — первая запрошенная «страница 1» пропускает первые 20 записей, и самые новые партии никогда не попадают в выдачу.

**4. `BatchService.cs` — `CloseAsync` — high**
Проверка «нет проб без результатов» и перевод в `Done` выполняются только для проб со статусом `InAnalysis` (`GetInAnalysisForBatchAsync`). Пробы в статусах `Planned`/`Collected` без результатов не проверяются и не блокируют закрытие — партия получает `ClosedAt`/`ReportDate`, хотя бизнес-правило из описания MR («закрыть партию с пробами без результатов нельзя») формально нарушено.

## Средние дефекты

**5. `BatchService.cs` — `GetCardAsync` — medium**
`Include(b => b.Samples).ThenInclude(s => s.Results)` тянет полные строки `Result`, а `Count`/`Any` считаются уже в памяти после материализации, хотя оба агрегата транслируются в SQL прямой проекцией без `Include`.

**6. `SampleRepository.cs` — `GetInAnalysisForBatchAsync` — medium**
Та же проблема: ради проверки «есть ли хоть один результат» в `CloseAsync` подгружается вся коллекция `Results` целиком, вместо скалярной проверки наличия.

**7. `BatchService.cs` — `CloseAsync` — medium**
Нет concurrency-токена на `Batch`/`Sample`. Два параллельных вызова `CloseAsync` оба пройдут валидацию и перезапишут `ClosedAt`/`ReportDate` без обнаружения конфликта.

## Низкие замечания

**8. `SampleRepository.cs` — `GetRecentBySiteAsync` — low**
Нет `Take`/пагинации — для активного объекта список проб за N дней может быть неограниченно большим.

**9. `BatchService.cs` — `RetagAsync` — low**
Нет проверки длины тега (лимит 40 символов в модели) — переполнение приведёт к необработанному исключению БД вместо доменной ошибки.