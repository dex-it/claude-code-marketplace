src/Pricing.Api/Program.cs:25 - ключ DI "e-mail" не совпадает с `[FromKeyedServices("email")]` в контроллере: контроллер не создаётся, все эндпоинты заказов отвечают 500 - blocker
src/Pricing.Api/Controllers/SupplierOrdersController.cs:66 - GetByNumber отдаёт сущность целиком: поставщик видит PurchasePrice, CostTotal и InternalNote, хотя ТЗ это запрещает; нужен отдельный DTO для портала - blocker
src/Pricing.Api/Controllers/SupplierOrdersController.cs:79 - GetLines отдаёт строки с PurchasePrice поставщику; цена закупки утекает - blocker
src/Pricing.Api/Controllers/SupplierOrdersController.cs:94 - List отдаёт сущности целиком (цена закупки, заметка закупщика) и при пустом SupplierId заказы всех поставщиков: утечка данных между поставщиками - blocker
src/Pricing.Api/Controllers/SupplierOrdersController.cs:107 - `async void` action: исключение из NotifyConfirmedAsync уронит процесс, ответ уходит до завершения, клиент не получает результат; нужен `async Task<ActionResult>` - blocker
src/Pricing.Api/Controllers/SupplierOrdersController.cs:109 - несуществующий заказ даёт 200 без тела вместо 404 - major
src/Pricing.Api/Controllers/SupplierOrdersController.cs:110 - нет проверки текущего состояния: можно подтвердить Cancelled/Rejected заказ и повторно подтвердить; состояние меняется без атомарности, до отправки уведомления - major
src/Pricing.Api/Controllers/SupplierOrdersController.cs:111 - сбой уведомления после смены State оставит заказ подтверждённым без письма, ни лога, ни повтора - major
src/Pricing.Api/Controllers/SupplierOrdersController.cs:56 - `catch (Exception)` возвращает ex.ToString() клиенту: стек и внутренности уходят наружу, глобальный обработчик обходится - major
src/Pricing.Api/Controllers/SupplierOrdersController.cs:70 - `catch (Exception)` вокруг тривиального поиска возвращает ex.Message клиенту и скрывает ошибки от глобального обработчика (то же на :83) - minor
src/Pricing.Api/Controllers/SupplierOrdersController.cs:25 - проверка уникальности номера и вставка не атомарны (линейный перебор + запись по Id): параллельные запросы создадут дубли номера у поставщика - major
src/Pricing.Api/Controllers/SupplierOrdersController.cs:44 - сумма считается через double и приводится к decimal: потеря точности в деньгах - major
src/Pricing.Api/Controllers/SupplierOrdersController.cs:34 - не валидируются пустой SupplierId, отрицательная PurchasePrice, Number <= 0: в хранилище попадут некорректные заказы - minor
src/Pricing.Api/Controllers/SupplierOrdersController.cs:21 - бизнес-логика (уникальность, валидация, расчёт суммы, хранение) в action, возврат `IActionResult` вместо `ActionResult<T>`: нет типа ответа в Swagger, логику не протестировать отдельно - minor
src/Pricing.Api/Controllers/SupplierOrdersController.cs:9 - поле Priority в запросе нигде не читается: клиент считает, что приоритет сохранён, а он теряется - minor
src/Pricing.Api/Controllers/SupplierOrdersController.cs:90 - SupplierOrderFilter.Status (строка 12) не применяется и нет пагинации: фильтр по статусу молча не работает, при тысячах заказов вернётся весь список - major
src/Pricing.Api/Controllers/SupplierOrdersController.cs:97 - фильтр по статусу и номер страницы в path, нет фильтра по поставщику: заказы чужих поставщиков видны, page <= 0 даёт отрицательный Skip и 500; фильтры и пагинация должны быть в query - major
src/Pricing.Api/Controllers/SupplierOrdersController.cs:103 - total в PageDto равен items.Count (размер страницы, не всего): клиент не может построить пагинацию - major
src/Pricing.Api/Controllers/SupplierOrdersController.cs:61 - обязательные supplierId и number в query вместо path (`suppliers/{supplierId}/orders/{number}`) - minor
src/Pricing.Api/Controllers/SupplierOrdersController.cs:74 - маршрут-глагол `fetch-supplier-order-lines` с обязательным orderId в query вместо `supplier-orders/{id}/lines` - minor
src/Pricing.Api/Controllers/SupplierOrdersController.cs:114 - служебная очистка "только для планировщика" доступна тем же хостом без авторизации/ограничения: любой вызов удалит отменённые заказы - major
src/Pricing.Api/Controllers/SupplierOrdersController.cs:20 - полные пути на каждом методе вместо `[Route("api/supplier-orders")]` на контроллере - minor
src/Pricing.Api/Controllers/SupplierOrdersController.cs:47 - `await Task.CompletedTask` бессмысленен, метод фактически синхронный - minor
src/Pricing.Domain/SupplierOrder.cs:3 - состояния Accepted/Confirmed и Rejected/Cancelled близки по смыслу и не описаны в схеме API: клиенты портала перепутают их - minor
