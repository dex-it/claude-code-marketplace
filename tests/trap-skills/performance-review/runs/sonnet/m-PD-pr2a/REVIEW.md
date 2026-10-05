# Ревью MR: модуль возвратов (Shop.Api)

Итого: blocker - 2, major - 8, minor - 5 (всего 15).

## Blocker

1. **Returns/ReturnsController.cs:36-52 (+ Program.cs:28-33)** - на контроллере нет `[Authorize]`, в `Program.cs` нет `UseAuthentication`/`UseAuthorization`. Единственная проверка - тенант по заголовку `Host`, а его задаёт клиент. Любой аноним может одобрить возврат (то есть вызвать выплату денег через шлюз), отклонить его, посмотреть список с именами клиентов или создать возврат по чужому `orderId` своего тенанта. Итог: несанкционированные выплаты и утечка персональных данных. Нужны аутентификация и роли: support для approve/reject/list, владелец заказа для create.

2. **Returns/ReturnService.cs:43-58** - одобрение не защищено от повторов и гонок.
   - Между проверкой `Status == Requested` и `SaveChanges` стоит внешний вызов шлюза. Concurrency token (xmin/RowVersion) нет, ключа идемпотентности в `RefundAsync` нет.
   - Двойной клик или два оператора вызывают два `POST refunds`, и деньги уходят дважды.
   - Одновременные approve и reject дают заявку `Rejected` при уже выплаченных деньгах.
   - Если `SaveChanges` упадёт после успешного шлюза, статус останется `Requested`, и повторный approve выплатит ещё раз.
   - Итог: прямые денежные потери. Нужны: перевод статуса в `Approving` одной атомарной записью с concurrency token, `Idempotency-Key` (например, `ReturnRequest.Id`) в запросе к шлюзу, сверка по ключу при повторе.

## Major

3. **Returns/ReturnsController.cs:27-33, Returns/ReturnMapper.cs:10-23, Program.cs:12** - N+1 на самом горячем эндпоинте. Список грузит `ReturnRequest` без `Include`, а включены lazy-loading proxies. Маппер на каждую заявку лениво тянет `Lines`, `Order`, `Order.Lines` и `Order.Customer`, причём синхронно. Это порядка 4 запросов на строку, около 200 на страницу из 50, плюс `First(...)` в цикле по строкам. При постоянном открытии списка и 400 RPS это быстро исчерпает пул соединений и потоки. Нужна проекция `Select` в `ReturnListItem` одним запросом (сумму считать в SQL, `AsNoTracking`). Тот же дефект в `ReturnService.cs:49-50` (approve): ленивые синхронные загрузки `Lines`, `Order`, `Order.Lines` внутри `Sum`. Лучше убрать `UseLazyLoadingProxies` совсем.

4. **Returns/ReturnValidator.cs:29** - условие `orderLine.Quantity < 0` проверяет заказанное количество, а не запрошенное. Верхней границы `line.Quantity <= orderLine.Quantity` нет. Дубли одного `OrderLineId` в `Lines` тоже не отсекаются. Можно вернуть 100 штук из заказанной одной, сумма в `Approve` посчитается как `UnitPrice * Quantity`. Итог: переплата при выплате. Нужны проверка `line.Quantity <= orderLine.Quantity` и уникальность `OrderLineId`.

5. **Returns/ReturnValidator.cs:21-22 + Migrations/20260910120000_AddReturns.cs:44-46** - проверка «по заказу уже есть заявка» не атомарна (check-then-insert), а уникального индекса по `OrderId` для активных статусов нет. Два параллельных POST создают две заявки, и каждую можно одобрить. Нужен частичный уникальный индекс `(OrderId) WHERE Status <> Rejected`, а `DbUpdateException` нужно превращать в ошибку валидации.

6. **Migrations/20260910120000_AddReturns.cs:5** - у класса нет `[DbContext(typeof(ShopDbContext))]` и `[Migration("20260910120000_AddReturns")]`, нет Designer и ModelSnapshot. EF Core такую миграцию не найдёт, и таблицы не будут созданы. Итог: на проде все эндпоинты отвечают 500 на отсутствующие таблицы. Таблица `Tenants` (используется в `TenantService.cs:21`) нигде не создаётся и не описана в модели.

7. **Returns/RefundGateway.cs:12, 21** - `new HttpClient` на каждый вызов при singleton-регистрации. Это исчерпание сокетов (TIME_WAIT) под нагрузкой, нет кэша DNS и пула, таймаут по умолчанию 100 с. Висящий шлюз удерживает запрос одобрения до 100 с. Нужен типизированный клиент через `AddHttpClient<RefundGateway>` с явным таймаутом и политикой повторов (повторы только с ключом идемпотентности, см. п.2).

8. **Infrastructure/TenantFilter.cs:11 (+ TenantService.cs:20-23)** - `.Result` на асинхронном запросе в синхронном фильтре. Это блокировка потока пула на каждый запрос при 400 RPS и риск thread-pool starvation. Плюс отдельный SQL к `Tenants` на каждый запрос без кэша. Нужны `IAsyncActionFilter` или middleware и `IMemoryCache` по host с коротким TTL.

9. **Returns/ReturnService.cs:39, 56, 68 + Notifications/ReturnNotifier.cs:23** - уведомление отправляется внутри запроса после коммита, а ловится только `HttpRequestException`. Таймаут (`TaskCanceledException`) и отмена пролетают наружу. Итог: клиент получает 500 при уже созданной заявке, а при approve - при уже выплаченных деньгах и со статусом `Refunded`. Повтор даёт 404, и оператор не понимает, что произошло. Кроме того, каждый вызов добавляет задержку шлюза уведомлений в ответ. Нужны outbox или фоновая очередь, либо как минимум перехват всех исключений, кроме отмены самого запроса.

10. **Returns/ReturnsReconciliationJob.cs:32, 46** - `gatewayIds` это `List<string>`, `Contains` внутри цикла. Это O(N*M): за 90 дней порядка 45 тыс. локальных на столько же шлюзовых, то есть около 10^9 сравнений строк, минуты CPU. Нужен `HashSet<string>`. Кроме того, `ListRefundsAsync` (RefundGateway.cs:22) забирает весь список за 90 дней одним ответом без пагинации.

## Minor

11. **Returns/ReturnValidator.cs:21** - `CountAsync(...) > 0` вместо `AnyAsync` (считает все совпадения вместо остановки на первом).

12. **Returns/ReturnPolicy.cs:9** - `DateTime.Now` (локальное время сервера) сравнивается с `CreatedAt`, которое хранится в UTC; в обход `IClock`. Граница окна возврата сдвигается на смещение часового пояса, а тест на время не написать. Нужно `clock.UtcNow`.

13. **Migrations/20260910120000_AddReturns.cs:44** - индекс `(TenantId, Status)` не обслуживает сортировку списка по `CreatedAt DESC` с `Skip/Take`. Список без фильтра по статусу сортирует все заявки тенанта. Нужен `(TenantId, Status, CreatedAt DESC)` и `(TenantId, CreatedAt DESC)`. Глубокий `Skip` тоже стоит заменить на keyset.

14. **Returns/ReturnsController.cs:43** - `CreatedAtAction(nameof(List), new { id })` указывает на список, а GET по id нет, Location получается бессмысленным. Заодно нет ограничения длины `Reason`.

15. **Returns/ReturnsReconciliationJob.cs:30-53** - сверка односторонняя (не находит возвраты, которые есть в шлюзе, но нет локально), результат только пишется в лог без метрики и алерта, выполняется на каждой реплике сразу при старте. `DateTime.UtcNow` вместо `IClock`.
