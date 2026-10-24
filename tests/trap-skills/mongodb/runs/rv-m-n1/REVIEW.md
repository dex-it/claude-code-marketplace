src/Fulfil/Archive/StockTransfer.cs:37 - транзакция на standalone-mongod из docker-compose (нет replica set): WithTransactionAsync падает, перенос остатков не работает вообще - blocker
src/Fulfil/Archive/OrderStore.cs:18 - новый MongoClient на каждый вызов (мимо зарегистрированного singleton IMongoClient): каждый клиент держит свой пул и мониторинговые потоки, под нагрузкой исчерпание соединений/сокетов - blocker
src/Fulfil/Archive/OrderDoc.cs:23 - имя и email клиента скопированы в каждый заказ: смена email/имени клиента не доходит до старых заказов, письмо об отгрузке уйдёт на устаревший адрес - major
src/Fulfil/Archive/OrderDoc.cs:19 - нет IgnoreExtraElements (ни атрибута, ни конвенции в MongoConventions.cs:16): документ с полем, которого нет в классе (старые/новые версии, ручные правки), даёт FormatException при чтении, заказ не открывается - major
src/Fulfil/Archive/ShippedWatcher.cs:31 - опрос коллекции каждые 5 с вместо change stream: постоянная нагрузка на базу вхолостую и задержка письма до 5 с; вместо этого слушать изменения статуса - major
src/Fulfil/Archive/ShippedWatcher.cs:47 - Mailed=true выставляется до отправки: падение процесса между claim и SendShippedAsync навсегда теряет письмо (откат в catch не выполнится) - major
src/Fulfil/Archive/ShippedWatcher.cs:57 - ошибка одного письма пробрасывается наружу цикла по ids: остальные заказы в пачке не обрабатываются до следующего круга, а неотправляемое письмо повторяется каждые 5 с бесконечно, блокируя хвост - major
src/Fulfil/Archive/ShippedWatcher.cs:41 - Task.Delay(ct) при остановке бросает OperationCanceledException из ExecuteAsync: шумное/ненормальное завершение хоста - minor
src/Fulfil/Archive/OrderStore.cs:61 - ListMineAsync читает заказы целиком (строки, события, теги), а нужны Id и Status; нужна проекция, иначе тяжёлый трафик и память на странице списка - major
src/Fulfil/Archive/OrderStore.cs:31 - Total считается через double из decimal: потеря точности денег (в базе double, не Decimal128) и расхождение с Order.Total - major
src/Fulfil/Archive/OrderDoc.cs:27 - Total как double: денежная сумма с ошибками округления при сравнении/агрегации - major
src/Fulfil/Archive/ArchiveInitializer.cs:10 - нет индексов под запросы по CustomerId/PlacedAt/Status (SearchAsync, ListMineAsync, ExportAsync): COLLSCAN с сортировкой в памяти на всей коллекции заказов, медленно и упрётся в лимит сортировки - major
src/Fulfil/Archive/ArchiveInitializer.cs:18 - порядок ключей индекса At, ToWarehouse, Sku нарушает equality-sort-range: HistoryAsync фильтрует по Sku и ToWarehouse равенством, индекс сканирует по времени всё подряд - major
src/Fulfil/Archive/ArchiveInitializer.cs:11 - partial-индекс по Status для Shipped и Mailed=false: после отправки записи выпадают, но сам индекс не помогает ни одному другому запросу по статусу (SearchAsync) - minor
src/Fulfil/Archive/OrderEvents.cs:14 - Push в массив Events внутри заказа без $slice/лимита: массив растёт неограниченно, документ упрётся в 16 МБ и каждое обновление раздувается - major
src/Fulfil/Archive/OrderEvents.cs:19 - ListAsync вынимает весь массив событий и режет Skip/Take в памяти: пагинация не уменьшает чтение, стоимость растёт с длиной ленты - major
src/Fulfil/Archive/CartDraftCleaner.cs:9 - чистка черновиков по таймеру DeleteMany вместо TTL-индекса на UpdatedAt, и без индекса: раз в час полный скан cart_drafts на каждом инстансе - major
src/Fulfil/Archive/CartDraftCleaner.cs:13 - исключение Mongo не перехвачено в ExecuteAsync: BackgroundService роняет весь хост (StopHost) при первом сбое базы - major
src/Fulfil/Archive/OrderStore.cs:57 - Skip(page * PageSize) для 0-базной страницы, тогда как ListMineAsync (:66) и OrderEvents используют page-1: путаница границ, при page=1 теряется первая страница, а глубокий Skip дорог - minor
src/Fulfil/Archive/OrderStore.cs:73 - ExportAsync без лимита/курсора грузит все заказы периода целиком в List: OOM на большом периоде - major
src/Fulfil/Archive/OrderStore.cs:35 - заказ и адрес пишутся двумя независимыми Replace в разные коллекции: сбой между ними оставляет заказ без адреса, чтение GetAsync делает два запроса вместо одного документа - minor
src/Fulfil/Archive/StockTransfer.cs:12 - ключ "sku|warehouse" неоднозначен, если sku или склад содержат "|": два разных остатка схлопнутся в одну запись - minor
