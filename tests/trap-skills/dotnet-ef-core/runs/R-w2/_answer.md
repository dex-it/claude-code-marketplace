# Ревью MR !4127 (сервисы заказов и каталога для админки)

## CRITICAL

1. **Migrations/20260920_OrderCategories.cs (Up) + Model.cs (`Order.Category`) + Services/OrderAdmin.cs (`UpdateOrder`)**
   Миграция делает `DropColumn("Category", "Orders")`, но модель (`Order.Category`, `Model.cs`, в MR не менялась) по-прежнему объявляет это свойство, и `OnModelCreating` не содержит ни `Ignore`, ни маппинга на новые таблицы `Categories`/`OrderCategories` (нет даже `DbSet<Category>` и join-сущности). По конвенции EF Core свойство `Category` остаётся замаппленным на несуществующую колонку — после применения миграции **любой** запрос к `Order` (включая уже существующий `OrderRepository`, а также новые `OrderQueries.GetCard/ExportForCustomer`, `OrderAdmin.UpdateOrder/RecalcTotal/OverdueReport`, `OverdueNotifier`) будет падать с ошибкой Npgsql `column "Category" does not exist`, а `OrderAdmin.UpdateOrder` дополнительно пытается записать в неё значение. Миграция должна идти вместе с обновлением модели (маппинг many-to-many через `OrderCategories`, удаление свойства `Category` из `Order`). Блокер мерджа.

2. **Migrations/20260920_OrderCategories.cs (Up)**
   Нет шага переноса данных: старые значения `Orders.Category` (произвольный текст) нигде не переносятся в новые `Categories`/`OrderCategories` перед `DropColumn`. На проде это безвозвратно теряет историю категоризации заказов. Нужен backfill (заполнить `Categories` уникальными значениями и проставить связи в `OrderCategories`) до удаления колонки.

3. **Services/CatalogService.cs, метод `Search`**
   SQL-шаблон: `SELECT * FROM "Products" p WHERE {0}`, но условия строятся как `"Products"."Category" = @p0` / `"Products"."Price" >= @p0` — то есть ссылаются на исходное имя таблицы, хотя в запросе она заалиасена как `p`. В PostgreSQL после алиаса имя таблицы недоступно для квалификации колонок — при любом непустом `category`/`minPrice` запрос упадёт с ошибкой вида `missing FROM-clause entry for table "Products"`. Работает только вызов без фильтров. Фактически основной сценарий метода сломан.

4. **Services/CatalogService.cs, метод `Reserve`**
   `FOR UPDATE` выполняется как самостоятельный `FromSqlRaw(...).SingleAsync()` без явной транзакции (`_db.Database.BeginTransactionAsync()`). В Postgres одиночный оператор выполняется в неявном автокоммитном блоке — блокировка строки снимается сразу после завершения `SELECT`, до проверки `Stock < qty` и последующего `SaveChangesAsync`. Пессимistic-lock не защищает от гонки: два параллельных резерва могут оба прочитать одинаковый `Stock`, оба пройти проверку и увести остаток в минус. Нужна явная транзакция, охватывающая `SELECT ... FOR UPDATE` и `SaveChangesAsync`.

5. **Services/OrderAdmin.cs, метод `RecalcTotal`**
   `order.Total = order.Items.Sum(i => prices[i.ProductId]);` — суммируются цены за единицу без умножения на `OrderItem.Qty`. По модели `Product.Price` — цена за единицу, `OrderItem.Qty` — количество (см. MR.md). Итог заказа считается неверно для любой позиции с `Qty != 1`. Должно быть `i.Qty * prices[i.ProductId]`.

6. **Services/OrderQueries.cs, метод `GetProductBySku`**
   `_db.Products.AsNoTracking().SingleAsync(p => p.Sku == sku)` — по модели один SKU лежит на нескольких складах и уникален только в рамках склада (см. MR.md, "Контекст модели"). Для любого SKU, представленного более чем на одном складе (обычный случай), `SingleAsync` бросит `InvalidOperationException` ("Sequence contains more than one element"). Метод должен либо принимать склад, либо возвращать коллекцию.

## HIGH

7. **Workers/OverdueNotifier.cs, конструктор/`ExecuteAsync`**
   `ShopDbContext` (регистрируется как Scoped через `AddDbContext`) внедряется напрямую в конструктор `BackgroundService`, который в DI-контейнере живёт как Singleton (`AddHostedService`) — классический captive dependency. Либо приложение падает на старте при включённой валидации скоупов, либо один и тот же экземпляр `DbContext` используется весь жизненный цикл процесса: `ChangeTracker` копит добавленные `AuditLog` каждую минуту без освобождения (утечка памяти), плюс риски с "протухшим" соединением при долгой работе. Нужно внедрять `IServiceScopeFactory` и создавать новый scope/контекст на каждую итерацию.

8. **Services/CatalogService.cs, метод `Reprice`**
   Товары получены обычным (трекаемым) запросом, после изменения `Price` дополнительно вызывается `_db.UpdateRange(products)`. Для уже отслеживаемых сущностей это лишнее и опасно: `UpdateRange` помечает **все** свойства сущности как Modified, а не только изменённое `Price`. Итоговый `UPDATE` перезапишет и `Stock`, используя то значение, что было прочитано в момент `ToListAsync` — если параллельно отработает `Reserve` и уменьшит `Stock`, `Reprice` затрёт это изменение устаревшим значением (lost update). Нужно убрать `UpdateRange` (EF и так отследит изменение `Price`).

9. **Services/OrderQueries.cs, метод `ExportForCustomer`**
   `Include(o => o.Items).Include(o => o.Payments)` без `AsSplitQuery()` — в отличие от `GetCard`, где сплит-запрос применён. Одиночный SQL-запрос с двумя коллекционными Include даёт декартово произведение Items × Payments на каждый заказ. Учитывая, что в MR.md прямо указано "у крупных клиентов тысячи заказов", это может привести к колоссальному раздутию результирующего набора и деградации/таймауту запроса.

10. **Services/OrderAdmin.cs, метод `OverdueReport` (+ используемый `OrderRepository.GetAllAsync`)**
    Метод тянет **весь** (по всем клиентам) список заказов через `_repo.GetAllAsync()` (`_db.Orders.ToListAsync()`, без `AsNoTracking`) в память и только потом фильтрует client-side через `IsOverdue`. Это полный скан таблицы заказов с включённым трекингом ради отчёта, где нужны только просроченные Id — и он дублирует (по-другому) логику, которая в `OverdueNotifier` уже корректно реализована через SQL-фильтр с `AsNoTracking`/`Select(Id)`. Нужно фильтровать на стороне БД аналогично воркеру, а не через `IsOverdue` на материализованном списке.

11. **Services/OrderAdmin.cs, методы `UpdateOrder` и `RecalcTotal`**
    В MR.md явно указано: "в админке несколько операторов правят заказы одновременно". Оба метода читают заказ (`FirstAsync`), правят поля и сохраняют без какой-либо проверки конкурентного изменения (нет concurrency token / `xmin`, нет проверки, что заказ не был изменён между чтением и записью). Результат — тихий lost update: правки одного оператора перезатираются другим без предупреждения.

## MEDIUM

12. **Services/OrderQueries.cs, метод `LastShippedAt`**
    `MaxAsync(o => o.ShippedAt)` возвращает `null`, если у клиента нет ни одного заказа с непустым `ShippedAt` (или нет заказов вовсе). Далее `last!.Value` — null-forgiving лишь подавляет предупреждение компилятора, в рантайме на `null` бросится исключение (`InvalidOperationException`/`NullReferenceException`). Нужна явная обработка отсутствия отгрузок.

13. **Workers/OverdueNotifier.cs, `ExecuteAsync`**
    Тело цикла (`while (!ct.IsCancellationRequested)`) не обёрнуто в try/catch. Любое временное исключение (обрыв соединения с БД, таймаут) не перехватывается — `BackgroundService` завершает выполнение, и воркер перестаёт писать `AuditLog` по просрочкам до перезапуска приложения.

## LOW

14. **Model.cs, `Order.ShippedAt`** (файл не менялся в MR, но напрямую задействован новой логикой просрочки)
    Для `CreatedAt` явно задан `HasColumnType("timestamp without time zone")`, а для `ShippedAt` — нет. По правилу команды (Npgsql 6+: свойство без явного типа маппится как `timestamptz`) получается несогласованное маппирование двух логически связанных полей одной сущности: `CreatedAt` — `timestamp without time zone`, `ShippedAt` — `timestamptz`. Пока это не проявляется (сравнение с параметром идёт только по `CreatedAt`, `ShippedAt` в SQL сравнивается только с `null`), но это заложенная ловушка на будущее (несовпадение `DateTimeKind` при появлении фильтра по `ShippedAt`).

15. **Migrations/20260920_OrderCategories.cs**
    FK `OrderCategories → Orders` с `onDelete: ReferentialAction.Cascade` соседствует с soft-delete паттерном заказа (`IsDeleted` + `HasQueryFilter`). Каскад сработает только при физическом DELETE строки `Orders`, которого в приложении, судя по всему, не происходит (используется мягкое удаление) — стоит подтвердить, что это осознанный выбор, а не "мёртвая" настройка. Также PK `(OrderId, CategoryId)` не даёт эффективного поиска "все заказы категории X" — если такой сценарий появится, потребуется отдельный индекс по `CategoryId`.
