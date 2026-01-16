---
description: Проектирование архитектуры .NET приложения
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
argument-hint: [domain-name] (опционально)
---

# /design

Команда для проектирования архитектуры нового приложения или компонента.

## Использование

```
/design                    # Интерактивный режим
/design e-commerce         # С указанием домена
/design OrderService       # Для конкретного сервиса
```

## Процесс

### 1. Сбор требований

Вопросы:
- Какой бизнес-домен?
- Какая ожидаемая нагрузка?
- Сколько разработчиков в команде?
- Какие интеграции нужны?

### 2. Определение архитектурного стиля

| Сценарий | Рекомендация |
|----------|--------------|
| Маленькая команда, простой домен | Modular Monolith |
| Большая команда, сложный домен | Microservices |
| MVP/Прототип | Simple Monolith |
| High-load read | CQRS + Read Replicas |
| Event-heavy | Event-Driven + Event Sourcing |

### 3. Генерация структуры проекта

**Clean Architecture:**
```bash
mkdir -p src/{Domain,Application,Infrastructure,Api}
mkdir -p src/Domain/{Entities,ValueObjects,Events,Interfaces,Exceptions}
mkdir -p src/Application/{Commands,Queries,Services,DTOs,Interfaces,Behaviors}
mkdir -p src/Infrastructure/{Persistence,Identity,Messaging,ExternalServices}
mkdir -p src/Api/{Controllers,Middleware,Filters}
mkdir -p tests/{Domain.Tests,Application.Tests,Infrastructure.Tests,Api.Tests}
mkdir -p docs/{adr,diagrams}
```

### 4. Создание базовых файлов

- Entity base class
- IUnitOfWork interface
- ValidationBehavior
- ExceptionMiddleware

### 5. Генерация диаграмм

- C4 Context diagram
- C4 Container diagram
- Component diagram

## Вывод

```
Architecture Design Complete

Project: OrderService
Style: Clean Architecture + CQRS

Structure created:
src/
├── Domain/          5 files
├── Application/     8 files
├── Infrastructure/  6 files
└── Api/             4 files

Next steps:
1. Review generated structure
2. Create ADR for key decisions: /adr
3. Implement domain entities
4. Setup CI/CD pipeline
```
