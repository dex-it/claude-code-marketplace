src/Pricing.Api/Controllers/SupplierOrdersController.cs:17 - ключ DI "email" не совпадает с регистрацией "e-mail" (Program.cs:24): контроллер не резолвится, все эндпоинты отдают 500 - blocker
src/Pricing.Api/Controllers/SupplierOrdersController.cs:107 - `async void` в Confirm: исключение notifier роняет процесс, ответ уходит до завершения, неизвестный заказ молча игнорируется без 404 - blocker
src/Pricing.Api/Controllers/SupplierOrdersController.cs:114 - внутренний DELETE очистки "только для планировщика" без авторизации: любой клиент удалит отменённые заказы - blocker
src/Pricing.Api/Controllers/SupplierOrdersController.cs:49 - Ok(order) и все GET (стр. 64, 78, 94, 104) отдают доменный SupplierOrder с PurchasePrice, CostTotal и InternalNote: закупочные цены и заметка закупщика утекают поставщику, вопреки задаче - blocker
src/Pricing.Api/Controllers/SupplierOrdersController.cs:87 - List без пагинации (тысячи заказов в месяц отдаются целиком), filter.Status не используется: фильтр по статусу молча не работает - major
src/Pricing.Api/Controllers/SupplierOrdersController.cs:12 - поле SupplierOrderFilter.Status никто не читает: клиент считает, что фильтрует, получает все заказы - minor
src/Pricing.Api/Controllers/SupplierOrdersController.cs:9 - поле Priority модели запроса никто не читает: значение молча теряется - minor
src/Pricing.Api/Controllers/SupplierOrdersController.cs:97 - статус и страница в path вместо query (параллельно существует List): два способа получить список, клиенты расходятся - minor
src/Pricing.Api/Controllers/SupplierOrdersController.cs:104 - PageDto.Total = items.Count (размер страницы), не общее число: клиент не видит остальных страниц; page<=0 даёт отрицательный Skip и 500 - major
src/Pricing.Api/Controllers/SupplierOrdersController.cs:60 - обязательные supplierId и number в query вместо path (suppliers/{supplierId}/orders/{number}) - minor
src/Pricing.Api/Controllers/SupplierOrdersController.cs:74 - обязательный orderId в query и маршрут-глагол "fetch-supplier-order-lines" вместо api/supplier-orders/{id}/lines - minor
src/Pricing.Api/Controllers/SupplierOrdersController.cs:14 - полный путь на каждом методе вместо [Route("api/supplier-orders")] на контроллере (как в ProductsController) - minor
src/Pricing.Api/Controllers/SupplierOrdersController.cs:21 - IActionResult вместо ActionResult<T> и нет ProducesResponseType: схема Swagger не описывает ответы (то же 61, 75, 88, 98, 115) - minor
src/Pricing.Api/Controllers/SupplierOrdersController.cs:25 - бизнес-логика (уникальность, расчёт суммы, валидация, удаление) в контроллере вместо сервиса приложения - major
src/Pricing.Api/Controllers/SupplierOrdersController.cs:25 - проверка уникальности и вставка не атомарны: параллельные запросы создают дубли номера у поставщика; плюс линейный скан всех заказов - major
src/Pricing.Api/Controllers/SupplierOrdersController.cs:28 - метки закупщика кладутся в extensions ProblemDetails: произвольные ключи из ERP затрут служебные ("type", "status") и уйдут в ответ клиенту - major
src/Pricing.Api/Controllers/SupplierOrdersController.cs:34 - BadRequest со строкой вместо ValidationProblem; Lines/SupplierId на null не проверены (NRE -> 500) - minor
src/Pricing.Api/Controllers/SupplierOrdersController.cs:44 - сумма денег считается через double: потеря точности в CostTotal - major
src/Pricing.Api/Controllers/SupplierOrdersController.cs:47 - `await Task.CompletedTask` без смысла, ct не используется - minor
src/Pricing.Api/Controllers/SupplierOrdersController.cs:54 - catch (Exception) с отдачей ex.ToString() клиенту: стек и внутренности наружу, ошибка не логируется, обходит DomainExceptionHandler - major
src/Pricing.Api/Controllers/SupplierOrdersController.cs:68 - catch (Exception) вокруг чтения словаря с отдачей ex.Message: скрывает сбои (то же 81) - minor
src/Pricing.Api/Controllers/SupplierOrdersController.cs:50 - ручной Conflict(PortalProblems) дублирует DomainExceptionHandler, формат ошибки (type) расходится с остальным API (extensions["code"]) - minor
src/Pricing.Api/Controllers/SupplierOrdersController.cs:108 - Confirm без проверки состояния и принадлежности заказа поставщику: можно подтвердить Rejected/Cancelled и чужой заказ - major
src/Pricing.Api/Controllers/SupplierOrdersController.cs:110 - состояние Confirmed выставляется до уведомления: при сбое notifier заказ подтверждён, письма нет, повтора нет - major
src/Pricing.Api/Portal/SupplierOrderStore.cs:19 - EmailOrderNotifier только пишет лог, письмо не отправляется: требование "уведомление закупщику письмом" не выполнено - major
src/Pricing.Api/Portal/SupplierOrderStore.cs:9 - заказы в ConcurrentDictionary в памяти singleton: потеря при рестарте и расхождение между инстансами; мимо слоя репозиториев - major
src/Pricing.Api/Portal/PortalProblems.cs:13 - ключи ex.Extensions копируются в problem.Extensions как есть: затирают стандартные члены ProblemDetails - minor
src/Pricing.Domain/SupplierOrder.cs:28 - PortalException (портал, детали ответа) в Domain: общий DomainExceptionHandler отдаст её как 409 без Extensions - minor
src/Pricing.Domain/SupplierOrder.cs:3 - значения SupplierOrderState New/Accepted/Confirmed/Rejected близки по смыслу и не описаны в схеме API: клиенты путают Accepted и Confirmed - minor
tests/Pricing.Tests:0 - на новый функционал нет тестов (создание, уникальность номера, подтверждение, очистка): регрессии не поймать - major
