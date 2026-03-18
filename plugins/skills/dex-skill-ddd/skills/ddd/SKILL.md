---
name: ddd
description: DDD тактические паттерны — ловушки aggregate, entity, value object. Активируется при DDD, domain driven, aggregate, value object, domain event, bounded context, aggregate root, anemic model, анемичная модель, repository pattern, domain service, specification, invariant, entity, ubiquitous language, domain layer
---

# DDD — ловушки и anti-patterns

## Aggregate

### Cross-aggregate navigation property
Плохо: `public Order Order { get; set; }` — навигация между агрегатами
Правильно: `public int OrderId { get; private set; }` — только ID
Почему: EF lazy-load тянет граф объектов (N+1), код меняет чужой Aggregate в обход Root, невозможно разнести по микросервисам

### Изменение состояния в обход Root
Плохо: `order.Items.Add(new OrderItem(...))` — прямой доступ к коллекции
Правильно: `order.AddItem(productId, quantity, price)` — метод на Root
Почему: инварианты Aggregate не проверяются, бизнес-правила (лимит товаров, проверка статуса) обходятся

### Несколько Aggregate в одной транзакции
Плохо: Handler меняет `Order` + `Inventory` + `Customer` → один `SaveChanges()`
Правильно: Handler меняет один Aggregate, связь через Domain Events / Outbox
Почему: блокировки в БД, при росте нагрузки — deadlocks. Невозможно масштабировать, нарушает bounded context

### Слишком большой Aggregate
Плохо: `Order` содержит `Items`, `Payments`, `ShippingHistory`, `AuditLog` — всё в одном Aggregate
Правильно: `Order` (Items), `Payment` (отдельный Aggregate), `Shipment` (отдельный Aggregate)
Почему: загрузка Order тянет всю историю, lock на Order блокирует оплату и доставку. Правило: если две сущности не обязаны быть консистентны в одной транзакции — разные Aggregate

## Entity

### Анемичная модель
Плохо: Entity с только `get; set;`, вся логика в `OrderService.Cancel(order)`
Правильно: `order.Cancel()` — логика внутри Entity, сервис только оркестрирует
Почему: бизнес-правила размазаны по сервисам, дублируются, легко обойти. Entity = данные без поведения = структура, не объект

### Public setters на Entity
Плохо: `public OrderStatus Status { get; set; }` — кто угодно меняет статус
Правильно: `public OrderStatus Status { get; private set; }` + метод `order.Cancel()`
Почему: переход Submitted → Cancelled допустим, Delivered → Submitted — нет. Без инкапсуляции инварианты состояния не защищены

## Value Object

### Мутабельный Value Object
Плохо: `public class Money { public decimal Amount { get; set; } }`
Правильно: `public record Money(decimal Amount, string Currency)`
Почему: Value Object с `set` теряет гарантию equality-by-value. Два объекта равны → один мутировал → второй "тоже изменился" в коллекциях/словарях

### Value Object без валидации в конструкторе
Плохо: `new Email("")` или `new Money(-100, "")` — создаётся невалидный объект
Правильно: валидация в конструкторе, `throw` при невалидных данных
Почему: "always valid" — главная гарантия Value Object. Если можно создать невалидный — проверки расползаются по всему коду

## Domain Events

### Events dispatch ДО SaveChanges
Плохо: публикация `OrderCreatedEvent` → подписчик запрашивает Order → его ещё нет в БД
Правильно: collect events → `SaveChangesAsync()` → dispatch events
Почему: подписчик получает событие о несуществующих данных, race condition между publish и persist

### Event без идемпотентности обработчика
Плохо: `OrderCreatedHandler` отправляет email без проверки "уже отправлен?"
Правильно: handler проверяет идемпотентность (по EventId или бизнес-ключу)
Почему: при retry (сбой после dispatch, до commit) событие обработается повторно — двойной email, двойное списание

### Domain Event содержит Entity целиком
Плохо: `record OrderCreatedEvent(Order Order)` — передаёт весь Aggregate
Правильно: `record OrderCreatedEvent(int OrderId, DateTime CreatedAt)` — только ID и нужные данные
Почему: Event = контракт. Изменение Entity ломает всех подписчиков, сериализация тянет граф объектов, нарушает bounded context

## Repository

### Repository для не-Aggregate Root
Плохо: `IOrderItemRepository` — отдельный репозиторий для вложенной сущности
Правильно: доступ к `OrderItem` только через `IOrderRepository` → `order.AddItem()`
Почему: `OrderItem` без `Order` не имеет смысла. Отдельный репозиторий позволяет обходить инварианты Aggregate Root

### Repository с бизнес-логикой
Плохо: `OrderRepository.CreateOrderWithDiscount()` — расчёт скидки в Repository
Правильно: Repository = CRUD для Aggregate, логика в Domain/Application
Почему: бизнес-логика привязана к persistence layer, при смене хранилища теряется

## Bounded Context

### Один DbContext на всё приложение
Плохо: `AppDbContext` с 50 DbSet — все доменные модели в одном контексте
Правильно: `OrderDbContext`, `IdentityDbContext`, `CatalogDbContext` — по bounded context
Почему: изменение одной модели = миграция всего контекста, конфликты между командами, медленная инициализация

### Domain Service с состоянием
Плохо: `PricingService` хранит кэш цен в поле, зарегистрирован как Scoped
Правильно: Domain Service — stateless, данные получает через параметры или Repository
Почему: состояние в сервисе = скрытая зависимость, проблемы с concurrency, непредсказуемое поведение при DI lifetime

### Specification pattern для простых запросов
Плохо: `new OrderByCustomerSpecification(customerId)` для `WHERE CustomerId = @id`
Правильно: Specification — для сложных составных фильтров, простые запросы — метод в Repository
Почему: overhead абстракции без выгоды. Specification оправдан при комбинируемых фильтрах (UI-грид с 10 фильтрами), не для одного WHERE

## Чек-лист

- Ссылки между Aggregate только по ID (не navigation property)
- Один Aggregate = одна транзакция = один SaveChanges
- Состояние меняется только через методы Aggregate Root
- Value Objects immutable (record) с валидацией в конструкторе
- Domain Events dispatch ПОСЛЕ SaveChanges
- Repository только для Aggregate Root
- Bounded Context = отдельный DbContext
