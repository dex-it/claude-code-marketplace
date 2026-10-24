## Выполнено

Реализованы все 4 задачи:

**Созданные/изменённые файлы:**
- `AgencyDbContext.cs` — добавлен unique constraint на Project.Code
- `20261002_AddUniqueConstraintToProjectCode.cs` — миграция EF
- `TimeEntryService.cs` — валидация max 12 часов/день на сотрудника
- `ProjectService.cs` — метод DeleteProjectsByClientAsync()
- `ReportService.cs` — сервис для годовой сводки
- `ReportsController.cs` — GET /api/reports/year/{year}
- `ClientsController.cs` — DELETE /api/clients/{id}/projects

**Решения:**  
**(а)** Сводка собирается из ClosedPeriods и TimeEntries с группировкой по месяцам — возвращает статус закрытия, дату акта и часы за месяц.  
**(б)** DeleteProjectsByClientAsync удаляет все проекты клиента soft-delete'ом в цикле — endpoint возвращает количество удалённых.  
**(в)** Unique индекс на Project.Code добавлен в модель, миграция обновляет существующий индекс.  
**(г)** ValidateDailyHoursAsync проверяет сумму часов сотрудника за день, выбрасывает исключение при превышении 12 часов.