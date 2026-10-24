---
name: kafka
description: Kafka — producers, consumers, exactly-once, ловушки. Активируется при kafka, producer, consumer, topic, partition, offset, consumer group, schema registry, kafkajs, confluent, avro, broker, rebalance, dead letter
---

# Kafka - чек-лист

Пункт называет ситуацию, которую исполнитель сам не заподозрит.

- Продьюсер без идемпотентности: повторы отправки дублируют и переупорядочивают сообщения
- Потребитель с накопленными несохранёнными смещениями: при ребалансе обработанное читается заново
- Ядовитое сообщение блокирует партицию потребителя
