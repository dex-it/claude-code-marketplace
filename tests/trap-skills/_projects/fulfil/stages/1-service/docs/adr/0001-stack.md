# ADR-0001: Стек и клиенты

Статус: принят, 2026-09-01.

- Среда: .NET 10, ASP.NET Core, один проект `src/Fulfil`.
- Kafka: Confluent.Kafka 2.16.0 (librdkafka), брокер Apache Kafka 4.2. Поток событий заказов.
- RabbitMQ 4.3: команды и процессы. Процессы и обмен сообщениями между сервисами - MassTransit 8.5.11
  (последняя линия под Apache-2.0). Интеграции с чужими очередями без MassTransit - RabbitMQ.Client 7.2.2.
- Redis 8.8: StackExchange.Redis 3.4.5.
- MongoDB 8.0: MongoDB.Driver 3.12.0.
- Elasticsearch 9.5: Elastic.Clients.Elasticsearch 9.5.3 (NEST не используется, снят с поддержки).
- Конфигурация - `FulfilOptions` из секции `Fulfil`; адреса сред подставляются переменными окружения.
- Тесты и сборку исполняет CI; локальный стенд - `docker-compose.yml`.
