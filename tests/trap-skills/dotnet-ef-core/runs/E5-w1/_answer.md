Изменённые/созданные файлы:
- /Users/anonymous/.cache/review/pr280/runs/E5-W1/Model.cs — изменён
- /Users/anonymous/.cache/review/pr280/runs/E5-W1/OrderRepository.cs — изменён
- /Users/anonymous/.cache/review/pr280/runs/E5-W1/ProductRepository.cs — создан

Решения:
- (а) UpdateOrder: добавлено поле `Order.RowVersion` (uint), замаппленное на системную колонку Postgres `xmin` через `.HasColumnName("xmin").HasColumnType("xid").IsRowVersion()`. `UpdateOrderAsync` выставляет присланное клиентом `RowVersion` как `OriginalValue` трекаемой сущности, поэтому EF добавляет `xmin = @original` в UPDATE; при параллельной правке другим оператором это даёт `DbUpdateConcurrencyException`, которое оборачивается в `OrderConcurrencyConflictException` вместо потерянного обновления. Заодно `GetAllAsync`/`GetAsync` переведены на `AsNoTracking()` (read-only выборки).
- (б) `ProductRepository.ReserveAsync`: явная транзакция + `SELECT * FROM "Products" WHERE "Id" = {0} FOR UPDATE` через `FromSqlRaw`, материализуется `ToListAsync()` без доп. LINQ-композиции (чтобы EF не оборачивал запрос в подзапрос и FOR UPDATE выполнялся как есть). Строка блокируется до конца транзакции, конкурентный `Reserve` того же товара ждёт коммита/отката и видит актуальный `Stock` — гонки при списании остатка исключены.
- (в) `ProductRepository.SearchAsync`: шаблон `"SELECT * FROM \"Products\" p WHERE {0}"`, условия (`p."Category" = {n}`, `p."Price" >= {n}`) — из захардкоженного набора фрагментов, значения никогда не конкатенируются в текст SQL, а идут отдельным списком параметров в `FromSqlRaw(sql, parameters)`, т.е. запрос остаётся параметризованным и защищённым от инъекций несмотря на динамическую сборку WHERE.
