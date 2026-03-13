---
name: microservices
description: Микросервисная архитектура, паттерны коммуникации, CQRS. Активируется при microservices, микросервисы, API gateway, service mesh, event-driven
allowed-tools: Read, Grep, Glob
---

# Microservices — ловушки и anti-patterns

## Когда НЕ использовать

| Сигнал | Почему это ловушка |
|--------|-------------------|
| Команда < 5 человек | Overhead инфраструктуры > выигрыш от изоляции |
| Простой домен без границ | Искусственные границы → distributed monolith |
| Нет DevOps экспертизы | Без CI/CD, мониторинга, tracing — микросервисы = хаос |
| MVP/Startup фаза | Границы домена неизвестны → неправильная декомпозиция → дорогой рефакторинг |

## Архитектурные ловушки

### Shared Database между сервисами
Плохо: OrderService и CatalogService читают/пишут в одну БД
Правильно: каждый сервис = своя БД, обмен через API или события
Почему: shared DB = скрытая связность. Изменение схемы в одном сервисе ломает другой. Невозможно масштабировать/деплоить независимо. Это монолит с сетевыми вызовами

### Distributed Monolith
Плохо: каждый HTTP-запрос вызывает цепочку A→B→C→D синхронно
Правильно: async events для cross-service communication, sync только для query (CQRS)
Почему: отказ одного сервиса = отказ всей цепочки. Latency суммируется. Хуже монолита: те же проблемы + сетевые ошибки + сложность деплоя

### Слишком мелкие сервисы (nano-services)
Плохо: отдельный сервис на каждую CRUD-операцию (UserService, UserProfileService, UserSettingsService)
Правильно: сервис = bounded context с бизнес-логикой, не CRUD endpoint
Почему: 50 nano-сервисов × инфраструктура (CI/CD, мониторинг, логирование) = 50x overhead. Логика размазана по сети

## Коммуникация

### Sync вызовы без Circuit Breaker
Плохо: `await httpClient.GetAsync("http://catalog-service/api/products")` — без retry и fallback
Правильно: Polly: retry → circuit breaker → fallback
Почему: catalog-service недоступен → timeout 30 сек × 100 запросов → thread pool exhaustion → cascade failure всех сервисов

### Consumer без idempotency
Плохо: `OrderCreatedConsumer` отправляет email без проверки "уже обработано?"
Правильно: проверяй MessageId/EventId перед обработкой, или делай операцию идемпотентной
Почему: message broker гарантирует at-least-once delivery. При retry, rebalance, network glitch — сообщение приходит повторно → двойная отправка, двойное списание

### Event содержит весь объект
Плохо: `OrderCreatedEvent { Order order }` — весь Aggregate в сообщении
Правильно: `OrderCreatedEvent { int OrderId, DateTime CreatedAt, decimal Total }` — только нужные данные
Почему: нарушает bounded context (consumer знает структуру чужого домена), сообщение раздувается, изменение Order ломает всех consumers

### Saga без компенсирующих транзакций
Плохо: Order → Payment → Shipping. Payment прошёл, Shipping упал → заказ в неконсистентном состоянии
Правильно: каждый шаг Saga имеет компенсацию: RefundPayment, CancelOrder
Почему: без компенсации — деньги списаны, товар не отправлен, откат ручной. Это самая дорогая ошибка в микросервисах

## Data Consistency

### Two-Phase Commit через сервисы
Плохо: распределённая транзакция OrderDB + InventoryDB через MSDTC/XA
Правильно: Outbox pattern + eventual consistency
Почему: 2PC блокирует обе БД до commit, coordinator failure = обе БД заблокированы. Не масштабируется, не работает с cloud managed databases

### Outbox без фоновой публикации
Плохо: сохранил event в outbox table, но нет background job для публикации
Правильно: BackgroundService polling outbox table → publish → mark as sent
Почему: events копятся в outbox, consumers ничего не получают. Нужен reliable publisher с retry и dead-letter

### Запрос данных из другого сервиса в реальном времени
Плохо: OrderService вызывает CatalogService.GetPrice() при каждом заказе → sync dependency
Правильно: OrderService хранит локальную копию цен (через events), обновляется через PriceChangedEvent
Почему: CatalogService down → OrderService не может создавать заказы. Локальная копия = автономность

## Observability

### Нет Correlation ID
Плохо: лог каждого сервиса отдельно, невозможно связать запрос через 5 сервисов
Правильно: CorrelationId генерируется в API Gateway, прокидывается через HTTP headers и message headers
Почему: "заказ не создан" → grep в 5 сервисах → тысячи записей → невозможно найти конкретный flow. С CorrelationId — один фильтр

### Health checks проверяют зависимости в liveness
Плохо: `/health/live` проверяет БД → БД недоступна → liveness fail → Kubernetes restart → cascade restart
Правильно: liveness = "процесс жив" (проверяет только приложение), readiness = "готов к трафику" (проверяет зависимости)
Почему: БД упала → все pods restart → все pods одновременно стартуют → thundering herd → БД ещё больше нагружена

## Чек-лист

- Каждый сервис = своя БД, нет shared database
- Async events для cross-service, sync только для query
- Circuit Breaker на все sync вызовы
- Idempotent consumers (проверка MessageId)
- Saga: каждый шаг имеет компенсацию
- Outbox pattern для guaranteed delivery + background publisher
- CorrelationId прокидывается через все сервисы
- Liveness ≠ readiness (не проверяй БД в liveness)
