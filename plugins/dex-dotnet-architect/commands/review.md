---
description: Ревью архитектуры проекта на соответствие Clean Architecture
allowed-tools: Read, Grep, Glob, Bash
argument-hint: [path] (опционально, по умолчанию src/)
---

# /review

Команда для проверки архитектуры проекта на соответствие Clean Architecture принципам.

## Использование

```
/review                # Проверить весь src/
/review src/Domain     # Проверить конкретный слой
/review --strict       # Строгий режим
```

## Проверки

### 1. Зависимости между слоями

**Правило:** Domain не должен зависеть ни от чего.

```bash
# Найти импорты Infrastructure в Domain
grep -r "using.*Infrastructure" src/Domain/
# Должно быть пусто!
```

**Матрица зависимостей:**
```
             Domain  Application  Infrastructure  Api
Domain         ✓         ✗            ✗          ✗
Application    ✓         ✓            ✗          ✗
Infrastructure ✓         ✓            ✓          ✗
Api            ✓         ✓            ✓          ✓
```

### 2. Структура Domain Layer

**Проверить наличие:**
- Entities/
- ValueObjects/
- Events/
- Interfaces/
- Exceptions/

**Антипаттерны:**
- DbContext в Domain
- HttpClient в Domain
- DTO в Domain

### 3. Aggregate Boundaries

**Правила:**
- Один Aggregate = одна транзакция
- Связь между Aggregates только по ID

```csharp
// Плохо
public class Order
{
    public Customer Customer { get; set; }  // Навигация!
}

// Хорошо
public class Order
{
    public int CustomerId { get; set; }  // Только ID
}
```

### 4. Domain Events

- Events наследуют от IDomainEvent
- Events immutable (record)
- Events содержат только данные

## Отчёт

```
Architecture Review: MyProject

PASSED (12)
├── Domain has no external dependencies
├── Application uses interfaces for Infrastructure
├── Aggregates properly bounded
├── Domain Events are immutable records
└── ...

WARNINGS (3)
├── Line 45 src/Domain/Entities/Order.cs
│   Customer navigation property found
│
└── Line 12 src/Application/Commands/CreateOrderHandler.cs
    Business logic in handler

VIOLATIONS (1)
└── Line 8 src/Domain/Services/OrderService.cs
    using MyProject.Infrastructure.Persistence;
    CRITICAL: Domain depends on Infrastructure!

Score: 8/10
```
