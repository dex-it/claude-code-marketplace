Готово. Создал сервис **OrderQueries.cs** с методами:

**(а)** `GetOrderCardAsync` — Select проекция с вложенными Items/Payments, избегает N+1 и раздувания Change Tracker.

**(б)** `GetCustomerOrdersAsync` — для тысяч заказов используется AsSplitQuery, чтобы избежать cartesian explosion при множественных Select.

**(в)** `GetProductBySkuAsync` — фильтр WHERE с опциональным warehouse.

**(г)** `GetLastShippedDateAsync` — OrderByDescending с Select на сервере (не материализация в памяти), возвращает DateTime.MinValue если нет отгруженных.

Ответ записан в `_answer.md`.