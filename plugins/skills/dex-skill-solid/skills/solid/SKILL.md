---
name: solid
description: SOLID принципы — ловушки SRP, OCP, LSP, ISP, DIP. Активируется при SOLID, god class, слишком много зависимостей, большой конструктор, рефакторинг класса, декомпозиция, fat interface, feature envy, YAGNI, проектирование
---

# SOLID в .NET — ловушки и anti-patterns

## SRP — Single Responsibility Principle

### UserService делает всё
Плохо: `UserService` содержит `CreateUser`, `SendWelcomeEmail`, `GenerateReport` — три разные причины изменения
Правильно: отдельные сервисы `UserRegistrationService`, `UserNotificationService`, `UserReportService`
Почему: при смене email-провайдера меняется класс с бизнес-логикой регистрации. Тесты требуют моков всего и сразу

### God method 200+ строк
Плохо: один метод с 5 if/else, вложенными циклами, try/catch и SQL — всё в одном
Правильно: декомпозиция на private методы по одному действию, или отдельные классы
Почему: невозможно протестировать частично, cyclomatic complexity > 10 = гарантированные баги при рефакторинге

### Feature envy
Плохо: метод обращается к 5+ полям чужого класса — `order.Customer.Address.City`, `order.Customer.Email`, `order.Customer.Phone`
Правильно: метод переносится в класс, чьи данные использует, или добавляется делегат
Почему: изменение `Customer` ломает `OrderService`. Нарушение инкапсуляции через длинные цепочки вызовов

## OCP — Open/Closed Principle

### Модификация if-else вместо Strategy
Плохо: каждый новый тип оплаты = `else if (payment.Type == "Crypto")` в существующем методе
Правильно: `Dictionary<PaymentType, IPaymentStrategy>` или DI-регистрация, resolve по ключу
Почему: правка работающего кода при добавлении фичи. Риск регрессий, ни один старый тест не проверяет новую ветку

## LSP — Liskov Substitution Principle

### throw NotSupportedException в наследнике
Плохо: `ReadOnlyRepo : Repository { override Save() => throw new NotSupportedException(); }`
Правильно: `IReadRepository<T>` и `IWriteRepository<T>` — разделить интерфейсы по контракту
Почему: код принимает `Repository` и ожидает рабочий `Save`. Нарушение контракта базового класса = runtime вместо compile-time

### Наследник усиливает предусловия
Плохо: базовый метод принимает `amount >= 0`, наследник требует `amount > 0 && amount < 1000`
Правильно: наследник не должен ужесточать проверки входных данных базового класса
Почему: код, написанный против базового типа, падает с неожиданными `ArgumentException` при подстановке наследника

## ISP — Interface Segregation Principle

### Fat interface с 15 методами
Плохо: `IUserService` содержит `Create`, `Update`, `Delete`, `SendEmail`, `GenerateReport`, `GetStats`, ...
Правильно: `IUserCommands`, `IUserQueries`, `IUserNotifications` — разделить по SRP
Почему: реализующий класс вынужден реализовывать ненужные методы через `throw` или пустые тела. Клиент зависит от методов, которые не использует

### Интерфейс для одного клиента
Плохо: `IAdminUserService` с 20 методами — весь CRUD + отчёты + аудит в одном интерфейсе
Правильно: узкие интерфейсы по use-case — `IUserReader`, `IUserWriter`, `IUserAudit`
Почему: любое изменение `IAdminUserService` затрагивает все реализации, даже те, что используют 2 из 20 методов

## DIP — Dependency Inversion Principle

### Бизнес-логика зависит от SqlConnection
Плохо: `OrderService(SqlConnection conn)` — сервис знает о конкретной БД
Правильно: `OrderService(IOrderRepository repo)` — сервис зависит от абстракции
Почему: смена БД, добавление кеша или мок в тестах требует изменения бизнес-кода. Зависимость направлена не туда

## Anemic Domain Model

### Вся логика в сервисах, entity — DTO
Плохо: `orderService.AddItem(orderId, productId, qty)` — entity `Order` без методов, только поля
Правильно: `order.AddItem(product, qty)` — логика, инварианты и валидация внутри агрегата
Почему: бизнес-правила размазаны по сервисам, инварианты не защищены. Та же логика дублируется в нескольких местах

## Чек-лист

- Конструктор с 3+ зависимостями → проверь, не нарушен ли SRP
- Метод 50+ строк → декомпозиция или god method?
- `if/else if` по типу → заменить на полиморфизм / Strategy
- `throw NotSupportedException` в наследнике → разделить интерфейсы (LSP)
- Интерфейс 8+ методов → разбить по ответственности (ISP)
- Сервис зависит от конкретного класса инфраструктуры → добавить абстракцию (DIP)
