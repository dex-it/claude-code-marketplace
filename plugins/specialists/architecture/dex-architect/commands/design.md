---
description: Проектирование архитектуры приложения
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
- Какой технологический стек? (уточнить у пользователя!)
- Какая ожидаемая нагрузка? (RPS, concurrent users)
- Сколько разработчиков в команде?
- Какие интеграции нужны?
- Какие NFR? (latency, availability, throughput)

### 2. Определение архитектурного стиля

| Сценарий | Рекомендация |
|----------|--------------|
| Маленькая команда, простой домен | Modular Monolith |
| Большая команда, сложный домен | Microservices |
| MVP/Прототип | Simple Monolith |
| High-load read | CQRS + Read Replicas |
| Event-heavy | Event-Driven + Event Sourcing |

### 3. Определение структуры слоёв

**Clean Architecture (стек-агностичный):**

| Слой | Ответственность | Зависимости |
|------|-----------------|-------------|
| Domain | Бизнес-логика, entities, value objects, domain events | Никаких |
| Application | Use cases, CQRS handlers, orchestration | Domain |
| Infrastructure | DB, messaging, external APIs, файловая система | Domain, Application |
| Presentation | API controllers/handlers, UI, CLI | Application |

Дополнительно:
- `tests/` — unit, integration, e2e тесты
- `docs/adr/` — Architecture Decision Records
- `docs/diagrams/` — C4 и другие диаграммы

### 4. Генерация диаграмм

- C4 Context diagram
- C4 Container diagram
- Component diagram

### 5. Создание ADR для ключевых решений

- Выбор архитектурного стиля
- Выбор технологий
- Ключевые trade-offs

## Вывод

```
Architecture Design Complete

Project: [ServiceName]
Style: [выбранный стиль]
Stack: [уточнённый стек]

Layers:
├── Domain/          entities, value objects, events
├── Application/     use cases, handlers
├── Infrastructure/  persistence, messaging
└── Presentation/    API, UI

Next steps:
1. Review generated structure
2. Create ADR for key decisions: /adr
3. Implement domain entities
4. Setup CI/CD pipeline
```
