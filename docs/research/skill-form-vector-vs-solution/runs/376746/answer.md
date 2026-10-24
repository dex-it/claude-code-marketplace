Ревью завершено, ответ сохранён в `/home/mmx/.cache/research/runs/376746/work/_answer.md`.

## Итог ревью MR !87

**Критичные:**
1. `BatchService.CompliancePercentAsync` — целочисленное деление `compliant / total * 100` даёт почти всегда 0% (деление выполняется раньше умножения).
2. `BatchService.CompliancePercentAsync` — `DivideByZeroException` при партии без проб (`total == 0`).

**High:**
3. `BatchService.CompliancePercentAsync` — `Results.All(...)` на пустой коллекции результатов возвращает `true`, проба без результатов засчитывается как «соответствующая».
4. `BatchService.ListAsync` — off-by-one в пагинации: `Skip(page * pageSize)` при нумерации страниц с 1 пропускает первую страницу (нужно `(page - 1) * pageSize`).
5. `BatchService.CloseAsync` — проверка «нет проб без результатов» смотрит только на пробы со статусом `InAnalysis`, игнорируя пробы в `Planned`/`Collected`, уже привязанные к партии — инвариант можно нарушить.

**Medium:**
6. `BatchService.CloseAsync` — нет защиты от конкурентной правки (TOCTOU между чтением проб и `SaveChanges`, нет concurrency-токена).

**Low:**
7. В списке изменённых файлов не упомянута миграция EF Core для новых колонок/сущности `SampleTag`.
8. `CompliancePercentAsync` делает два round-trip к БД вместо одного с условной агрегацией.

Отдельно отметил, что часть паттернов (DateTime/Npgsql kind, `AsNoTracking`, `AsSplitQuery`, параметризация `FromSql`, `SingleOrDefault` по уникальному индексу, отсутствие `SaveChanges` в цикле) реализована корректно и вопросов не вызывает.