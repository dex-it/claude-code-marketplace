---
description: Создание Architecture Decision Record (ADR)
allowed-tools: Read, Write, Grep, Glob
argument-hint: <title> (название решения)
---

# /adr

Команда для создания Architecture Decision Records.

## Использование

```
/adr "PostgreSQL как основная БД"
/adr "Выбор микросервисной архитектуры"
/adr "JWT для аутентификации"
```

## Процесс

### 1. Определить номер ADR

```bash
next_num=$(ls docs/adr/ADR-*.md 2>/dev/null | wc -l)
next_num=$((next_num + 1))
printf "ADR-%03d" $next_num
```

### 2. Собрать информацию

**Вопросы:**
- Какую проблему решаем?
- Какие есть ограничения?
- Какие альтернативы рассматривали?
- Почему выбрали это решение?
- Какие последствия?

### 3. Создать файл

**Путь:** `docs/adr/ADR-{NUM}-{slug}.md`

### 4. Заполнить шаблон

```markdown
# ADR-{NUM}: {TITLE}

## Status
Proposed

## Date
{TODAY}

## Context
{Описание проблемы}

## Decision
{Решение}

## Consequences

### Positive
- ...

### Negative
- ...

### Risks
- ...

## Alternatives Considered

### Alternative 1: {Name}
...

## References
- ...
```

## Популярные ADR

- Выбор базы данных
- Выбор архитектуры
- Аутентификация
- Message Broker
- API Gateway

## Вывод

```
ADR Created

File: docs/adr/ADR-003-rabbitmq-messaging.md

# ADR-003: RabbitMQ для межсервисной коммуникации

Status: Proposed
Date: 2024-01-25

Summary:
- Decision: RabbitMQ с MassTransit
- Alternatives considered: 3
- Key consequence: Need RabbitMQ infrastructure

Index updated: docs/adr/README.md

Next steps:
1. Review with team
2. Update status to Accepted/Rejected
3. Create implementation tasks
```
