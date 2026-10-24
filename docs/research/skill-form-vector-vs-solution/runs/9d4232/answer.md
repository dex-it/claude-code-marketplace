Решение завершено. Внёс изменения во все необходимые файлы:

**Файлы:** Models.cs, HousingDbContext.cs, HousingService.cs, PlanService.cs, _answer.md

**Решение:**
- (а) Сортировка реестра: параметры `Sort` (date|address|status) и `Dir` (asc|desc) в RequestSearch, динамический SQL с правильным ORDER BY; для адреса добавлены JOIN-ы домов и квартир
- (б) Закрытие заявки: новый метод CloseRequestAsync с валидацией InProgress статуса и обязательным комментарием в поле CloseComment  
- (в) Обновление плана: UpdatePlanAsync полностью переписывает список работ, удаляя с explicit Clear() историю ненужных, обновляя существующие, добавляя новые
- (г) Телефон в заявке: поля Phone в ServiceRequest и RequestCard, передача при создании заявки через NewRequest