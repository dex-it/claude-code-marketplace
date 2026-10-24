# Судья ревизии s: mongodb (RV-M, G-M), прогоны s1, s2
Судья - оператор смены. Ревизия s = r плюс название «Многодокументная транзакция там, где развёрнут одиночный mongod без replica set» (правило 11, коммит `42b92978` до прогонов).

## RV-M (mongodb/runs/rv-m-s1, rv-m-s2)
| ед. | s1 | s2 | основание |
|---|---|---|---|
| M11 | 1 | 1 | s1 StockTransfer.cs:37 + docker-compose, «Transaction numbers are only allowed on a replica set member»; s2 StockTransfer.cs:37 то же |
| M3 | 1 | 1 | OrderDoc.cs:23 копия имени и email |
| M4 | 1 | 1? | s1 OrderStore.cs:39 «две коллекции, читаются двумя запросами, проще встроить»; s2 :35 только последствие (заказ без адреса) |
| M8 | 1 | 1 | OrderStore.cs:63 |
| M9 | 1 | 1 | ShippedWatcher.cs:31 |
| M10 | 1 | 1 | MongoConventions.cs:18 / :16 |
| O1 | 1 | 1 | OrderStore.cs:31 double |
| O2 | 1 | 1 | OrderStore.cs:57 |
| P1 | 0 | 0 | ExportAsync major в обоих - дефект ключа P1, как в c/n/r |

## G-M (mongodb/runs/g-m-s1, g-m-s2) - выборочная проверка по DIFF.patch и ANSWER.md
| ед. | s1 | s2 | основание |
|---|---|---|---|
| M11 | 1 | 1 | перенос остатков без транзакции: два условных обновления с компенсацией, ограничение названо (s1 DIFF:327, ANSWER «Один mongod»; s2 DIFF:355, ANSWER «Одиночный mongod») |
| M3, M4, M7, M8, M10 | 1 | 1 | имя и email не копируются, адрес встроен (ShippingAddress), TTL-индекс `ExpireAfter` 30 дней (s1 :189, s2 :211), `Project`, `[BsonIgnoreExtraElements]` на документах |
| M9 | 1? | 1? | реакция обработчиком на смену статуса без опроса (s1 ShippedNotifier не подписан, сам указал; s2 условный переход в `OrderStore.ChangeStatusAsync`); спорная клетка как в протоколе (ключ буквален - Change Streams, на одиночном mongod недоступны) |

Остальные единицы G-M (M1, M2, M5, M6) не перепроверялись построчно: задета только фразой про транзакции единица M11; изменений в них от добавленного названия не ожидается.
