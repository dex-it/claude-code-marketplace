Изменённые/созданные файлы:
- /Users/anonymous/.cache/review/pr280/runs/E5-N1/Model.cs — изменён
- /Users/anonymous/.cache/review/pr280/runs/E5-N1/OrderRepository.cs — изменён
- /Users/anonymous/.cache/review/pr280/runs/E5-N1/ProductRepository.cs — создан

Решения:
- (а) У Order добавлено поле Version, замаппленное на системную колонку Postgres "xmin" и помеченное IsRowVersion(). OrderRepository.UpdateOrderAsync аттачит "болванку" по Id, применяет редактируемые поля и явно выставляет OriginalValue токена версии = тому, что оператор прочитал при загрузке заказа. EF добавляет в UPDATE условие "AND xmin = @original", поэтому при параллельной правке вторым оператором SaveChanges бросает DbUpdateConcurrencyException, которое оборачивается в OrderConcurrencyConflictException — вызывающий код должен перечитать заказ и попросить оператора повторить/смёржить правку, а не молча перезаписывать чужие изменения.
- (б) ProductRepository.ReserveAsync открывает явную транзакцию и делает FromSqlRaw("SELECT * FROM \"Products\" WHERE \"Id\" = {0} FOR UPDATE", productId), блокируя строку до commit/rollback; только после этого проверяется Stock >= qty и списывается остаток, что исключает гонки при параллельных резервах того же товара.
- (в) ProductRepository.SearchAsync собирает WHERE из фиксированных фрагментов (имена колонок/операторы, без значений) в текст SQL, а сами значения category/minPrice передаются отдельным списком args в FromSqlRaw(sql, args) — они попадают в запрос как настоящие параметры Npgsql, а не через конкатенацию строк, поэтому динамический фильтр не подвержен SQL-инъекциям.
