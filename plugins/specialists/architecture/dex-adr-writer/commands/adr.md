---
description: Создание Architecture Decision Record (ADR) в формате MADR
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
next_num=$(ls docs/adr/ADR-*.md 2>/dev/null | grep -oP 'ADR-\K\d+' | sort -n | tail -1)
next_num=$(( ${next_num:-0} + 1 ))
printf "ADR-%03d" $next_num
```

### 2. Собрать информацию

**Вопросы:**
- Какую проблему решаем?
- Какие decision drivers (ограничения, требования)?
- Какие альтернативы рассматривали?
- Почему выбрали это решение?
- Какие последствия?

### 3. Создать файл

**Путь:** `docs/adr/ADR-{NUM}-{slug}.md`

### 4. Заполнить шаблон (MADR)

```markdown
# ADR-{NUM}: {TITLE}

## Status
Proposed

## Date
{TODAY}

## Decision Drivers
- {что повлияло на решение}

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

## Links
- {Связь с другими ADR или внешние ссылки}
```

### 5. Supersession (если заменяет старый ADR)

- В новом ADR: `## Links` → `Supersedes [ADR-XXX](ADR-XXX-slug.md)`
- В старом ADR: `## Status` → `Superseded by [ADR-YYY](ADR-YYY-slug.md)`

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

Decision Drivers: latency, team expertise, operational cost
Decision: RabbitMQ
Alternatives considered: 3

Index updated: docs/adr/README.md

Next steps:
1. Review with team
2. Update status to Accepted/Rejected
3. Create implementation tasks
```
