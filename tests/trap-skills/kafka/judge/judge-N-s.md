# Судья ревизии s: N-G и N-RV (пять файлов вместе: kafka 1.2.0, mongodb s, rabbitmq s, redis r, elasticsearch r), прогоны s1, s2
Судья - оператор смены.

## N-G (kafka/runs/n-g-s1, n-g-s2)
Изменены `Domain/Order.cs`, `Domain/VolumeDiscount.cs`, `tests/...` и служебные `Directory.Packages.props`, `Fulfil.sln`, csproj тестов (как в `r`): брокеров, хранилищ, compose не тронуто. Правило: пороги 10 000 и 50 000 включительные, 5 % и 10 %, округление вниз до копеек (s1 `Math.Floor(discounted * 100m) / 100m`, тест 10000.01 -> 9500.00; s2 `Math.Floor(total * (100 - процент)) / 100`) - верно. N-G s1 1/1, s2 1/1; в обоих ответах исполнитель сам называет, что чек-листы к задаче не относятся.

## N-RV (kafka/runs/n-rv-s1, n-rv-s2), находки blocker/major по коду `catalog-sync`
| прогон | blocker + major | ложных | какие |
|---|---|---|---|
| s1 | 18 (1 + 17) | 3 | OrderFulfilmentStateMachine.cs:68 (откат Shipping, как в judge-N-r), Program.cs:19 (порты без реализаций, как в judge-N-r), WarehouseInboundConsumer.cs:89 (exchange не объявлен: склад - внешний, объявление не задано) |
| s2 | 18 (3 + 15) | 3 | OrderFulfilmentStateMachine.cs:68, Program.cs:16 (порты), ProductIndexer.cs:53 (последовательная загрузка в живой алиас, как в judge-N-r) |

Правка после ревью (mmx003, PR #381): в `s2` по хвостам строк `runs/n-rv-s2/REVIEW.md` 3 blocker и 15 major (было записано 2 + 16), сумма 18 та же.

Остальные находки - те же типы, что признаны настоящими в `judge-N-r.md` (три схемы в `orders`, `mailed == false`, ReplaceOne затирает статус, Seek без предела, Nack без DLX, `_id=sku` против пересчёта, MailJobQueue без try, /internal без авторизации, ReindexService). Среднее ложных 3,0 на прогон: не хуже `f` (3,5) и `r` (3,0). Оценка по строкам выборочная (схожесть с таблицей `judge-N-r.md`), построчная сверка с кодом ветки не повторялась.
