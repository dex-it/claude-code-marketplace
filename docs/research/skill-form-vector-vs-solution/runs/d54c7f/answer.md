Code review завершён. Найдено **5 дефектов**:

| № | Файл | Метод | Дефект | Severity |
|---|------|-------|--------|----------|
| 1 | BatchService.cs | ListAsync | Ошибка в пагинации: `Skip(page * pageSize)` вместо `Skip((page - 1) * pageSize)` | **high** |
| 2 | BatchService.cs | CompliancePercentAsync | Целочисленное деление: `compliant / total * 100` вместо `compliant * 100 / total` | **high** |
| 3 | SampleRepository.cs | GetRecentBySiteAsync | Raw SQL `FromSql` вместо LINQ с Include — снижает тестируемость | **medium** |
| 4 | Models.cs + LabDbContext.cs | — | PlannedLocal: локальное время без timezone, Site.TimeZoneId не используется | **medium** |
| 5 | LabDbContext.cs | OnModelCreating | SampleTag отсутствует в DbSet, только конфигурируется | **low** |

Все находки записаны в `/home/mmx/.cache/research/runs/d54c7f/work/_answer.md`.