**Завершено.** Создан файл `OrderQueries.cs` с четырьмя методами:

- **(а) GetOrderAsync**: загружает заказ со всеми позициями и платежами через Include()
- **(б) GetCustomerOrdersAsync**: выгружает все заказы клиента с позициями/платежами одним запросом
- **(в) GetProductBySku**: при указанном warehouse — точный поиск, при null — возвращает товар только если он один (иначе null)
- **(г) GetLastShippedAtAsync**: находит последний отгруженный заказ через OrderByDescending и FirstAsync()

Детали записаны в `_answer.md`.