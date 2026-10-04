Провёл ревью `Models.cs`, `LabDbContext.cs`, `SampleRepository.cs`, `BatchService.cs` по чек-листу EF Core и общей логике MR. Основные находки (полный текст также записан в `_answer.md`):

**Critical**
1. `BatchService.CompliancePercentAsync` — деление на ноль при партии без проб (`total == 0`).

**High**
2. `BatchService.CompliancePercentAsync` — целочисленное деление `compliant / total * 100` обрезает процент до 0 в большинстве случаев; нужно `compliant * 100 / total`.
3. `BatchService.CompliancePercentAsync` — `Results.All(...)` на пустой коллекции результатов возвращает `true`, проба без результатов засчитывается как «соответствующая норме».
4. `BatchService.ListAsync` — `Skip(page * pageSize)` при нумерации страниц с 1 пропускает первую страницу результатов (off-by-one).

**Medium**
5. `BatchService.GetCardAsync` — тянет полные сущности через `Include`/`ThenInclude` вместо проекции в DTO, хотя запрос только читает конкретные поля (нарушение правила «полная сущность там, где нужна часть полей»).
6. `BatchService.CloseAsync` — нет оптимистической блокировки/токена конкурентности: параллельные закрытия одной партии молча перезатирают `ClosedAt`/`ReportDate`.

**Low**
7. `BatchService.CloseAsync` — не проверяет пробы в статусах `Planned`/`Collected`; партия может закрыться с «подвисшими» пробами.
8. `SampleRepository.GetRecentBySiteAsync` — граница «последние N дней» считается по UTC-полуночи, а не по локальному времени объекта (`Site.TimeZoneId`), что противоречит акценту MR на местное время.

Код не менял, сборку/тесты не запускал, работал только с файлами в указанном каталоге и `SKILL.md`.