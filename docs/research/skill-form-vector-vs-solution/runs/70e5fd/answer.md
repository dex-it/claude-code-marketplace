Готово. Список файлов и описание решений записаны в _answer.md. Вот краткая сводка выполненных задач:

**Созданные/изменённые файлы:**
- ReportService.cs, ReportsController.cs (задача а)
- ClientsController.cs, ProjectService.cs обновлен (задача б)
- TimeEntryService.cs обновлен (задача г)
- AgencyDbContext.cs обновлен, Migrations/20261002_AddUniqueIndexOnProjectCode.cs (задача в)

**Решения:**
- (а) Endpoint возвращает сводку за год с датами закрытия месяцев и суммой часов, группировка в SQL
- (б) DeleteProjectsByClientAsync загружает все проекты одним запросом и удаляет одним SaveChangesAsync вместо round-trip на каждый
- (в) Уникальное ограничение на Project.Code через IsUnique() в индексе + миграция с DropIndex/CreateIndex для efbundle
- (г) Проверка EnsureDailyHoursLimitAsync считает сумму часов в SQL, исключая текущую запись при правке, выбрасывает 400 при превышении 12 часов