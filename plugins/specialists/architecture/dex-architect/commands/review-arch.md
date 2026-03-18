---
description: Ревью архитектуры проекта по чек-листу
allowed-tools: Read, Grep, Glob, Bash
argument-hint: [path-to-project] (опционально)
---

# /review-arch

Ревью архитектуры проекта по чек-листу. Анализирует структуру, зависимости, NFR, безопасность.

## Использование

```
/review-arch              # Ревью текущего проекта
/review-arch src/         # Ревью конкретной директории
```

## Процесс

### 1. Discover Structure
- Найти корневую директорию проекта
- Определить технологический стек (по файлам: *.csproj, package.json, go.mod, pom.xml и др.)
- Определить архитектурный стиль (Clean Architecture, MVC, microservices и др.)
- Найти слои/модули

### 2. Check Dependencies
- Проверить направление зависимостей (Domain НЕ зависит от Infrastructure)
- Найти circular dependencies
- Проверить DI registration

### 3. Review NFR
- Есть ли health checks?
- Есть ли structured logging?
- Есть ли metrics/tracing?
- Есть ли rate limiting?
- Есть ли retry/circuit breaker для внешних вызовов?

### 4. Review Security
- Аутентификация/авторизация настроены?
- Input validation на границах?
- Нет ли hardcoded secrets?
- CORS настроен корректно?

### 5. Generate Report

## Checklist

| Категория | Проверка | Статус |
|-----------|----------|--------|
| **Layers** | Domain не зависит от Infrastructure | |
| **Layers** | Нет circular dependencies | |
| **Data Access** | Нет N+1 queries (lazy loading в циклах) | |
| **Data Access** | Есть миграции БД | |
| **Security** | Auth настроен | |
| **Security** | Input validation на границах | |
| **Security** | Нет hardcoded secrets | |
| **Observability** | Structured logging | |
| **Observability** | Health checks | |
| **Observability** | Metrics/tracing | |
| **Resilience** | Retry/Circuit Breaker для внешних вызовов | |
| **Resilience** | Graceful shutdown | |
| **API Design** | Versioning | |
| **API Design** | Error response format (RFC 9457) | |

## Выходной формат

```
Architecture Review Report
━━━━━━━━━━━━━━━━━━━━━━━━━━

Project: [name]
Stack: [detected stack]
Style: [detected style]

Layers:           ✅ Pass (3/3)
Data Access:      ⚠️ Warning (1/2)
Security:         ✅ Pass (3/3)
Observability:    ❌ Fail (1/3)
Resilience:       ⚠️ Warning (1/2)
API Design:       ✅ Pass (2/2)

Issues found: N
Recommendations: M

Details:
[per-category findings]
```
