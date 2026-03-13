---
name: clean-architecture
description: Clean Architecture паттерны для ASP.NET Core, структура слоёв, правила зависимостей. Активируется при clean architecture, onion, hexagonal, слои приложения
---

# Clean Architecture — ловушки и anti-patterns

## Нарушение Dependency Rule

### Domain зависит от Infrastructure
Плохо: `Domain.csproj` содержит `PackageReference` на `EntityFrameworkCore`
Правильно: Domain проект без внешних зависимостей, только .NET BCL
Почему: Domain становится привязан к ORM, невозможно заменить persistence без изменения бизнес-логики

### Application → DbContext напрямую
Плохо: `handler` инжектит `AppDbContext` и вызывает `context.Users.Where(...)`
Правильно: инжектить `IUserRepository` / `IUnitOfWork`, реализация в Infrastructure
Почему: Application знает про EF — при смене ORM/хранилища меняется Application слой вместо одного Infrastructure

### Circular dependency между слоями
Плохо: Infrastructure вызывает методы из Application (не через интерфейсы)
Правильно: Infrastructure реализует интерфейсы, определённые в Application
Почему: Circular reference между проектами → невозможно собрать, или скрытая связность через DI

## Утечки абстракций

### IRepository возвращает IQueryable
Плохо: `IOrderRepository { IQueryable<Order> GetAll(); }`
Правильно: `IOrderRepository { Task<List<Order>> GetByCustomerAsync(int customerId); }`
Почему: клиент строит SQL через LINQ → привязка к конкретному провайдеру, невозможно заменить на API/файл/кэш. Тесты не могут мокать поведение IQueryable корректно

### Domain entity выставляет persistence-детали
Плохо: `public virtual ICollection<OrderItem> Items { get; set; }` — навигация EF в Domain
Правильно: `private readonly List<OrderItem> _items; public IReadOnlyCollection<OrderItem> Items => _items.AsReadOnly();`
Почему: `virtual` + setter = EF lazy loading протекает в Domain, бизнес-логика зависит от прокси

### DTO используется как Domain model
Плохо: один класс `UserDto` передаётся от Controller до Repository
Правильно: отдельные модели на каждый слой: `CreateUserRequest` → `CreateUserCommand` → `User` entity → `UserResponse`
Почему: изменение API контракта ломает Domain, изменение Domain ломает API. Связность между слоями через общую модель

## Бизнес-логика не на своём месте

### Логика в Controller
Плохо: Controller проверяет баланс, рассчитывает скидку, сохраняет заказ
Правильно: Controller → `Send(new CreateOrderCommand(...))` → Handler содержит логику
Почему: логика дублируется между контроллерами, невозможно переиспользовать из другого entry point (gRPC, CLI, message handler)

### Валидация в Domain вместо Application
Плохо: `Order.Create()` проверяет что CustomerId существует в базе (делает запрос)
Правильно: Handler проверяет существование через `ICustomerRepository`, затем вызывает `Order.Create()`
Почему: Domain не должен зависеть от I/O. Domain валидирует инварианты (Amount > 0), Application — бизнес-правила с I/O

### Логика в Infrastructure
Плохо: `OrderRepository.CreateOrder()` содержит бизнес-расчёты и валидацию
Правильно: Repository только CRUD, бизнес-логика в Domain/Application
Почему: при смене хранилища теряется бизнес-логика. Тесты Infrastructure = тесты бизнеса

## Транзакционные ловушки

### Несколько SaveChangesAsync в Handler
Плохо: `await _unitOfWork.SaveChangesAsync()` вызывается 2-3 раза в одном Handler
Правильно: один `SaveChangesAsync()` в конце Handler (или через pipeline behavior)
Почему: partial commit — при ошибке на втором save первый уже в БД, нет атомарности. Rollback невозможен

### Domain Events dispatch ДО SaveChanges
Плохо: публиковать события до `SaveChangesAsync()` — подписчик читает данные, которых ещё нет в БД
Правильно: собрать события → `SaveChangesAsync()` → dispatch события
Почему: подписчик получает `OrderCreatedEvent`, делает запрос — Order не найден (ещё не сохранён)

### MediatR Handler вызывает другой Handler
Плохо: `CreateOrderHandler` внутри вызывает `_mediator.Send(new UpdateInventoryCommand(...))`
Правильно: один Handler = одна транзакция. Связь между операциями через Domain Events или Outbox
Почему: вложенные Handler'ы — скрытые зависимости, неопределённый порядок выполнения, проблемы с транзакциями

## Тестирование

### Тестирование через HTTP вместо Unit
Плохо: все тесты бизнес-логики через `WebApplicationFactory` + HTTP client
Правильно: Unit тесты Domain (чистые), Unit тесты Handler'ов (мок репозитория), Integration через HTTP — только API контракт
Почему: HTTP тесты медленные, хрупкие (ломаются при смене роутинга), не покрывают edge cases бизнес-логики

### Mock всего дерева зависимостей
Плохо: мокается 10 интерфейсов чтобы протестировать один Handler
Правильно: Handler зависит от 1-3 интерфейсов. Если больше — нарушен SRP, нужен рефакторинг
Почему: тест с 10 моками — сигнал что Handler делает слишком много. Тест хрупкий и нечитаемый

## Структурные ошибки

### Папка-на-слой вместо Feature Slice
Плохо: `Application/Commands/`, `Application/Queries/`, `Application/Validators/` — 50 файлов в каждой папке
Правильно: `Application/Orders/Create/`, `Application/Orders/Cancel/` — command + handler + validator рядом
Почему: при 100+ use cases навигация по типу файла невозможна. Feature slice = всё для одной фичи в одной папке

### God DbContext
Плохо: один `AppDbContext` с 50+ DbSet — все Aggregate Root в одном контексте
Правильно: bounded context = свой DbContext (`OrderDbContext`, `IdentityDbContext`)
Почему: один контекст = одна огромная миграция, конфликты между командами, медленный startup (EF компилирует все модели)

### Общий проект Shared/Common
Плохо: проект `Shared` с утилитами, на который ссылаются все слои
Правильно: каждый слой содержит свои вспомогательные классы, общие только абстракции (Domain.Primitives)
Почему: Shared становится свалкой, любое изменение в нём пересобирает всё решение, нарушает принцип минимальных зависимостей

## Чек-лист

- Domain.csproj не имеет PackageReference (кроме Nullable, Annotations)
- Application зависит только от Domain
- Infrastructure реализует интерфейсы из Application
- Controller только маршрутизирует (3-5 строк на action)
- Один Handler = одна транзакция = один SaveChanges
- Domain Events публикуются ПОСЛЕ SaveChanges
- IRepository НЕ возвращает IQueryable
- Feature Slice структура (не папка-на-тип)
