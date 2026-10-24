Готово! Выполнены все 4 задачи:

## Созданные/изменённые файлы:
- **ReportService.cs** (новый)
- **ProjectService.cs** (добавлен `DeleteProjectsByClientAsync`)
- **AgencyDbContext.cs** (IsUnique на Project.Code)
- **TimeEntryService.cs** (валидация 12 часов/день)
- **Migrations/20261002_AddProjectCodeUnique.cs** (новый)
- **Migrations/AgencyDbContextModelSnapshot.cs** (новый)
- **_answer.md** (новый)

## Решения:
(а) **ReportService** со строго типизированным методом `GetYearReportAsync(year)` – сводка по месяцам с датой акта и суммой часов.

(б) **DeleteProjectsByClientAsync** – удаление всех проектов клиента одной операцией через soft-delete фреймворка.

(в) Уникальный индекс на Project.Code добавлен в модель и миграцию EF; выкатка обычным efbundle в pipeline.

(г) **ValidateDailyHoursAsync** проверяет сумму часов сотрудника за день ≤ 12; выброс `DailyHoursLimitExceededException` для 400-ответа при нарушении, корректная обработка при редактировании записи.