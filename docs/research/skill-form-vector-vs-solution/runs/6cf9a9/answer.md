Проведено code review MR !87. Выявлены **5 дефектов**, из них:

## Критические (требуют немедленного исправления)

1. **BatchService.ListAsync:49** — неправильная формула `Skip(page * pageSize)` должна быть `(page - 1) * pageSize`. Первая страница выводит записи 21-40 вместо 1-20.

2. **BatchService.CompliancePercentAsync:107** — целочисленное деление `compliant / total * 100` дает ноль при compliant<total. Плюс нет защиты от деления на ноль.

## Высокой серьёзности

3. **BatchService.CompliancePercentAsync:105** — `.All()` в LINQ запросе может неправильно перевести в SQL, приведет к загрузке всех данных в память.

4. **Sample.PlannedLocal** — время хранится как "timestamp without time zone" без привязки к TimeZoneId объекта. При восстановлении неясно, к какой зоне оно относится.

## Средней серьёзности

5. **SampleRepository.GetRecentBySiteAsync** — raw SQL вместо LINQ, не загружаются связи Tags/Results.

Результаты записаны в `_answer.md`.