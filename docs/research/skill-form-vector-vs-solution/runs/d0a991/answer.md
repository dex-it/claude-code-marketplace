Провёл ревью MR !4127. Результат записан в `/Users/anonymous/.cache/research/runs/d0a991/work/_answer.md`, ниже — тот же список.

## Critical

**Migrations/20260920_OrderCategories.cs `Up()` + Model.cs `Order.Category`**
Миграция дропает колонку `Orders.Category`, а `Model.cs` (не менялся) по-прежнему маппит `Order.Category`, активно используемое в `OrderAdmin.UpdateOrder`. После миграции любой запрос к `Order` упадёт — колонки нет в БД, а EF пытается её селектить/апдейтить.

**Migrations/20260920_OrderCategories.cs `Up()` — потеря исторических данных**
Колонка `Category` дропается без переноса значений в новые `Categories`/`OrderCategories`. Схема меняется, а данные не переносятся — существующая категоризация заказов теряется безвозвратно.

**Workers/OverdueNotifier.cs (конструктор / `ExecuteAsync`)**
Scoped `ShopDbContext` внедрён напрямую в singleton `BackgroundService`. Либо падение на старте при валидации scope, либо один и тот же контекст живёт и используется весь lifetime приложения в цикле раз в минуту. Нужен `IServiceScopeFactory`/`IDbContextFactory` на каждой итерации.

**Services/OrderAdmin.cs `RecalcTotal`**
`order.Total = order.Items.Sum(i => prices[i.ProductId])` — суммируются только цены за единицу, без `Qty`. По контексту модели должно быть `i.Qty * prices[i.ProductId]`. Сумма заказа неверна при `Qty != 1`.

**Services/CatalogService.cs `Reserve`**
`FOR UPDATE` выполняется без явной транзакции, охватывающей последующий `SaveChangesAsync`. Блокировка строки снимается сразу после коммита SELECT (собственной неявной транзакции), ещё до UPDATE — параллельные `Reserve` могут оба пройти проверку остатка по одному значению и оба списать сток (овербукинг).

**Services/CatalogService.cs `Search`**
Шаблон задаёт алиас `p` (`FROM "Products" p`), но условия ссылаются на исходное имя таблицы (`"Products"."Category"`/`"Price"`). PostgreSQL запрещает обращение к исходному имени после назначения алиаса — запрос упадёт при любом непустом фильтре.

## High

**Services/OrderQueries.cs `ExportForCustomer`** — две коллекции (`Items`, `Payments`) в одном `Include` без `AsSplitQuery` (в отличие от `GetCard`) → декартово произведение, критично при "тысячах заказов" у клиента.

**Services/OrderQueries.cs `GetProductBySku`** — `SingleAsync` по SKU, хотя SKU уникален только в рамках склада, а не глобально — упадёт для любого товара на нескольких складах.

**Services/OrderQueries.cs `LastShippedAt`** — `MaxAsync` может вернуть `null` (нет отгруженных заказов), далее `last!.Value` без проверки — `NullReferenceException`.

**Services/OrderAdmin.cs `UpdateOrder`** — нет optimistic concurrency (RowVersion/токен), при этом MR явно говорит про параллельную правку заказов операторами — lost update.

**Services/OrderAdmin.cs `OverdueReport`** — через `OrderRepository.GetAllAsync()` материализует всю таблицу заказов, фильтр `IsOverdue` применяется уже в памяти, хотя условие прекрасно транслируется в SQL.

## Medium

**Migrations/20260920_OrderCategories.cs `FK_OrderCategories_Orders`** — каскад на FK к `Orders`, хотя `Order` использует soft-delete (`HasQueryFilter`); по конвенции FK зависимых должен быть без каскада.

**Services/CatalogService.cs `Reprice`** — `UpdateRange` вызывается на уже отслеживаемых сущностях, помечает все колонки как Modified и рискует затереть параллельно изменённые поля (например, `Stock`, меняемый в `Reserve`) устаревшими значениями.