Завершено! Реализованы все четыре задачи:

**Измененные файлы:**
- `Models.cs` — добавлены поля PhoneNumber и CompletionComment
- `HousingService.cs` — добавлены параметры сортировки Sort/Dir в SearchAsync, реализован CloseRequestAsync с проверкой статуса, обновлены RequestRow/RequestCard/NewRequest для телефона
- `PlanService.cs` — реализован UpdatePlanAsync для полной замены плана с сохранением истории

**Решения:**
- **(а) Сортировка**: SearchAsync конструирует ORDER BY в SQL на основе Sort (date/address/status) и Dir (asc/desc), добавляя необходимые JOIN'ы только для адресной сортировки; фильтры работают как раньше.
- **(б) Закрытие**: CloseRequestAsync проверяет статус InProgress, требует непустой комментарий, устанавливает Done и сохраняет комментарий; исключение преобразуется контроллером в 409.
- **(в) План дома**: UpdatePlanAsync явно удаляет отсутствующие работы, обновляет Title/PeriodDays существующих, добавляет новые; история Completions сохраняется через рефаренцирование.
- **(г) Телефон**: PhoneNumber опциональное поле в ServiceRequest, передается через NewRequest, возвращается в RequestCard/RequestRow.