## Готово

Выполнил все 4 поручения в проекте Domovoy.Housing:

**Файлы:** Models.cs, HousingService.cs, PlanService.cs, HousingDbContext.cs

**Решения:**
- **(а)** Сортировка заявок: добавлены параметры `Sort` (date/address/status) и `Dir` (asc/desc) в `RequestSearch`, SQL динамически составляется с `ORDER BY` по выбору, по умолчанию дата DESC (новые сверху)
- **(б)** Закрытие заявки: метод `CloseRequestAsync` проверяет статус InProgress (иначе исключение для 409), переводит в Done, сохраняет обязательный комментарий
- **(в)** Обновление плана: метод `UpdatePlanAsync` удаляет ненужные работы, обновляет существующие (история сохраняется), добавляет новые за один SaveChanges
- **(г)** Телефон заявителя: поле `PhoneNumber` в `ServiceRequest`, передаётся при создании заявки, видно в карточке и реестре

Ответ записан в `/home/mmx/.cache/research/runs/f10a22/work/_answer.md`