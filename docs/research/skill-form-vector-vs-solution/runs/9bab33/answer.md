Провёл ревью MR !87. Основные находки (полный текст также записан в `/home/mmx/.cache/research/runs/9bab33/work/_answer.md`):

**1. `BatchService.CompliancePercentAsync` — critical**
`compliant / total * 100` — целочисленное деление до умножения, результат почти всегда 0% или 100%; при пустой партии (`total == 0`) — `DivideByZeroException`. Метрика LAB-147 для дашборда фактически не работает.

**2. `BatchService.ListAsync` — high**
Off-by-one в пагинации: XML-комментарий заявляет «страница с 1», но `Skip(page * pageSize)` при `page=1` пропускает первую страницу целиком. Нужно `Skip((page - 1) * pageSize)`.

**3. `BatchService.CloseAsync` — high**
Проверка «без результатов» и перевод в `Done` смотрят только на пробы со статусом `InAnalysis` (`GetInAnalysisForBatchAsync`). Пробы той же партии со статусом `Planned`/`Collected` не проверяются и не завершаются — партия закрывается с «подвешенными» пробами, к которым код больше не возвращается.

**4. `BatchService.CloseAsync` / `RetagAsync` — medium**
Нет concurrency-токена (`xmin`/rowversion) на `Batch`/`Sample` — параллельная правка одной записи (два закрытия партии, закрытие+переразметка) молча перезатирает изменения без конфликта, что прямо противоречит пункту чек-листа команды.

**5. `SampleRepository.GetRecentBySiteAsync` — low**
Новый запрос фильтрует `samples` по `site_id`/`collected_at`, но индекса под этот паттерн нет — риск seq scan на росте таблицы.

**6. `SampleRepository.GetRecentBySiteAsync` — low**
Raw `FromSql` там, где джойн по `Site.Code` + фильтр по `CollectedAt` полностью транслируется обычным LINQ; сам по себе безопасен (параметризованная интерполяция, не `FromSqlRaw`), но излишне и повышает риск рассинхронизации с моделью.

Проверил и подтвердил корректность: типы `DateTime`/`Kind` под Npgsql (`PlannedLocal` как `timestamp`/Unspecified, `ClosedAt`/`ReportDate` как `timestamptz`/Utc), `AsSplitQuery` для коллекций в `GetCardAsync`, уникальность для `Single(OrDefault)`, отсутствие `SaveChanges` в цикле, и поведение `Tags.Clear()` при required-связи с конвенционным Cascade.