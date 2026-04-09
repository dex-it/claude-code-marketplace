---
description: Ревью архитектуры проекта -- анализ структуры, зависимостей, NFR, безопасности
allowed-tools: Read, Grep, Glob
argument-hint: "[path-to-project] (опционально)"
---

# /review-arch

Ревью архитектуры существующего проекта.

## Goal

Проанализировать архитектуру проекта и выдать отчёт с конкретными проблемами и рекомендациями. Определить стек и стиль автоматически по файлам проекта.

## Input

Аргумент -- путь к проекту. Без аргумента -- текущая директория.

## Process

1. **Discover** -- определить стек (по csproj, package.json, go.mod, pom.xml), архитектурный стиль, структуру слоёв
2. **Analyze** -- проверить направление зависимостей, найти нарушения, оценить NFR-покрытие
3. **Report** -- сгруппированные findings с severity и рекомендациями

## Output

Отчёт по категориям:
- **Layers** -- направление зависимостей, circular dependencies
- **Data Access** -- N+1, миграции, connection management
- **Security** -- auth, input validation, secrets, CORS
- **Observability** -- structured logging, health checks, metrics/tracing
- **Resilience** -- retry/circuit breaker, graceful shutdown
- **API Design** -- versioning, error format

Каждый finding: что нашли, где (файл + строка), severity, рекомендация.

Делегировать агенту `architect`.
