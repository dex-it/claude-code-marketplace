---
description: Интерактивная архитектурная сессия по бизнес-задаче — интервью, capacity, reference match, план реализации
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
argument-hint: "[бизнес-задача в свободной форме]"
---

# /design

Запустить полноценную архитектурную сессию: от бизнес-задачи на естественном языке до implementation-плана с CAP/PACELC trade-off'ами.

## Goal

Провести пользователя через 8 фаз агента `architect`: Codebase Priming → Understand Requirements → Capacity Estimation → Reference Architecture Match → Propose Alternatives → Decide → Deep Dive → Implementation Plan (+ опциональный Document).

## Input

Аргумент — бизнес-задача в свободной форме («хочу новостную ленту», «нужен сервис уведомлений», «как переехать с монолита на сервисы»).

Если аргумент не передан — агент интерактивно запрашивает задачу в первом сообщении.

## Output

Структурированный отчёт по фазам:

- **Phase 0:** обзор существующего репо (если не greenfield)
- **Phase 1:** заполненные слоты Requirements (functional + non-functional + constraints + success metrics)
- **Phase 2:** таблица capacity (read/write QPS peak, storage год 1-3, bandwidth, read:write ratio)
- **Phase 3:** match с reference architecture + список адаптаций
- **Phase 4:** 2-3 альтернативы с Mermaid-диаграммами
- **Phase 5:** выбранное решение + CAP/PACELC trade-off'ы (требует подтверждения пользователя)
- **Phase 6:** deep dive (storage schema, API, caching, sharding, failure modes, observability)
- **Phase 7:** implementation plan (walking skeleton → vertical slices → scale-out)
- **Phase 8 (опционально):** ADR / C4 / architecture description

## Constraints

- Не предлагать решение до Capacity Estimation
- Минимум 2 жизнеспособных альтернативы в Phase 4
- Phase 5 требует explicit confirmation пользователя перед Deep Dive
- Для .NET-специфичной сессии (с конкретными ASP.NET Core / EF Core / MassTransit) — делегировать `architect-dotnet`

Делегировать агенту `architect`.
