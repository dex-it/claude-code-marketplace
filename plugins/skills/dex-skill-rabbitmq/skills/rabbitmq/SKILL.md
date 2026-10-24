---
name: rabbitmq
description: RabbitMQ - prefetch прямого консьюмера, сохранение и публикация события без потери, откат шагов саги. Активируется при rabbitmq, masstransit, saga, outbox, prefetch, consumer, dead-letter, retry, idempotency, amqp, ack, nack, queue, exchange
---

# RabbitMQ - чек-лист

Пункт называет ситуацию, которую исполнитель сам не заподозрит.

- Прямой консьюмер без ограничения prefetch: весь backlog очереди в памяти пода
- Сохранение данных и публикация события двумя шагами: падение между ними теряет событие
- Сага без отката выполненных шагов при сбое последующего
