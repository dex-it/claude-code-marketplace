Провёл ревью MR !87, прочитал `SKILL.md` и изменённые файлы (`Models.cs`, `LabDbContext.cs`, `SampleRepository.cs`, `BatchService.cs`). Полный текст сохранён в `/home/mmx/.cache/research/runs/633c72/work/_answer.md`. Ключевые находки:

**1. `BatchService.CompliancePercentAsync` — critical.** `compliant / total * 100` — целочисленное деление `int/int`, почти всегда даёт 0% вместо реального процента; плюс `DivideByZeroException` при пустой партии (`total == 0`).

**2. `BatchService.CompliancePercentAsync` — medium.** `s.Results.All(...)` на пустой коллекции результатов возвращает `true` — пробы без результатов засчитываются как «в норме», завышая процент соответствия.

**3. `BatchService.ListAsync` — high.** `Skip(page * pageSize)` при нумерации страниц с 1 (как указано в doc-комментарии) пропускает первую страницу — первая (самая новая) страница партий недостижима. Должно быть `Skip((page - 1) * pageSize)`.

**4. `BatchService.CloseAsync` — medium.** Проверка «нет проб без результатов» смотрит только на пробы в статусе `InAnalysis`; пробы `Planned`/`Collected`, уже привязанные к партии, не проверяются и не блокируют закрытие — могут зависнуть в закрытой партии без результатов.

**5. `BatchService.RetagAsync` — medium.** Нет concurrency-токена у `Sample`; параллельная переразметка одной пробы двумя лаборантами молча перезаписывает друг друга (lost update), что прямо противоречит правилу команды про параллельную правку записи.

**6. `BatchService.CloseAsync` / `SampleRepository.GetInAnalysisForBatchAsync` — low.** Грузятся полные строки `Results` ради одного `Count == 0`.

**7. `BatchService.CloseAsync` — low.** Нет защиты от повторного закрытия уже закрытой партии.

**8. `LabDbContext.cs`/`Models.cs` — low.** `BatchInstrument.InstrumentCode`/`Operator` без `HasMaxLength`, в отличие от `SampleTag.Tag`.

Блокирующими до мерджа считаю пункты 1 и 3 — они ломают именно те фичи, ради которых сделан MR (дашборд соответствия и пагинация партий).