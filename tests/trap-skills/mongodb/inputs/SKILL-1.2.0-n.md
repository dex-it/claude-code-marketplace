---
name: mongodb
description: MongoDB — schema design, индексы, aggregation, ловушки. Активируется при mongodb, mongo, bson, aggregation pipeline, document database, mongoose, mongosh, replica set, ObjectId, collection, find, updateMany, atlas, NoSQL
---

# MongoDB - чек-лист

Пункт называет ситуацию, которую исполнитель сам не заподозрит.

- Копия изменяемых данных клиента в каждом документе заказа
- Список читает документы целиком, когда нужны два поля
- Опрос коллекции по таймеру вместо реакции на изменение
- Документы в базе старше класса: лишние элементы при десериализации
