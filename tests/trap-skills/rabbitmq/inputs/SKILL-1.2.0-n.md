---
name: rabbitmq
description: RabbitMQ — MassTransit, retry, dead-letter, idempotency, ловушки. Активируется при rabbitmq, message queue, masstransit, consumer, dead-letter, saga, amqp, amqplib, exchange, queue, binding, prefetch, ack, nack
---

# RabbitMQ - чек-лист

Пункт называет ситуацию, которую исполнитель сам не заподозрит.

- Прямой консьюмер без ограничения prefetch: весь backlog очереди в памяти пода
- Сохранение заказа и публикация события двумя шагами: падение между ними теряет событие
- Сага без отката выполненных шагов при сбое последующего
