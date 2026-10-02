## Итоги ревью

**Ключевые дефекты (high, блокируют мердж):**

1. **CustomerExport.cs / `CustomersWithOrders`** — `AsNoTracking()+Include` не делает identity resolution, `Customer` без `Equals`/`GetHashCode`, поэтому `.Distinct()` не дедуплицирует клиентов с несколькими заказами → дубли в CRM-выгрузке.
2. **SalesReport.cs / `Build`** — запрос по `OrderItems` не фильтрует `Order.Status`, в выручку и проданное количество попадают позиции `Rejected`/неоплаченных заказов → искажённая финансовая отчётность.

**Medium:**
3. SalesReport.cs / `Build` — грузит все товары (включая `Image`) и агрегирует продажи в памяти O(P×I) вместо `GroupBy` в БД.
5. StockImport.cs / `Import` — синхронное блокирующее чтение файла в async-методе.
6. StockImport.cs / `Import` — нет валидации отрицательного `qty`, портит остатки.
7. StockImport.cs / `Import` — линейный поиск товара в `List` вместо `Dictionary`, O(N×M).
8. StockImport.cs / `Import` — нет обработки ошибок доступа к файлу, необработанное исключение роняет job.

**Low:**
4. SalesReport.cs — нет `AsNoTracking()` для read-only запроса.
9–10. CatalogSearch.cs / `Search` — дублирование веток запроса, нет пагинации.
11. CustomerExport.cs / `HasOrders` — `CountAsync()>0` вместо `AnyAsync()`.

Полный список с деталями и обоснованием записан в `/Users/anonymous/.cache/research/runs/aadcb9/work/_answer.md`.