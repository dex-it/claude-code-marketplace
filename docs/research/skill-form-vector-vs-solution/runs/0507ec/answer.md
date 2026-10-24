Готово! Реализовал все 4 поручения для сервиса управляющей компании.

## Созданные/изменённые файлы

**Изменённые:**
- Models.cs — добавлены `PhoneNumber?` и `CompletionComment?` в `ServiceRequest`
- HousingService.cs — параметры sort/dir в `RequestSearch`, сортировка в SQL, метод `CloseRequestAsync`, поля PhoneNumber в records
- PlanService.cs — метод `UpdatePlanAsync`

**Созданные:**
- Migrations/20261002000000_AddPhoneNumberAndCompletionComment.cs — миграция полей
- Endpoints.cs — endpoints для POST /requests/{id}/close и PUT /houses/{id}/plan

## Решения

**(а)** Сортировка реестра: `sort` и `dir` параметры в запросе, сортировка по дате (DESC по умолчанию), адресу (с квартирой), статусу в SQL.

**(б)** Закрытие заявки: проверка статуса InProgress, обязательный комментарий, возврат 409 через InvalidOperationException.

**(в)** План дома: метод заменяет весь список работ (удаляет отсутствующие, обновляет параметры, добавляет новые), сохраняя историю выполнения.

**(г)** Телефон заявителя: опциональное поле PhoneNumber в ServiceRequest, диспетчер заполняет при приёме, мастер видит в карточке.