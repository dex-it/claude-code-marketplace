---
description: Интерактивная .NET-архитектурная сессия - интервью, capacity, reference match, план реализации с ASP.NET Core / EF Core / MassTransit
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
argument-hint: "[бизнес-задача в свободной форме / путь к апрувнутым требованиям из /feature]"
---

# /design-dotnet

Запустить полноценную архитектурную сессию для .NET-проекта: от бизнес-задачи на естественном языке до implementation-плана с конкретными ASP.NET Core / EF Core / MassTransit / Polly / Serilog решениями.

## Goal

Провести пользователя через 8 фаз агента `architect-dotnet`: Codebase Priming -> Understand Requirements -> Capacity Estimation -> Reference Architecture Match -> Propose Alternatives -> Decide -> Deep Dive -> Implementation Plan (+ опциональный Document).

## Input

Аргумент - постановка в одной из двух форм:

- **бизнес-задача в свободной форме** («нужен сервис уведомлений на .NET», «как переехать с монолита») - требования уточняются в Phase 1;
- **апрувнутый набор требований зоны 1** (путь к `FR`/`NFR` системного уровня и user stories, приходит из `/feature`; вход только BRD с `BR-NNN`, без системного уровня - принимается как бизнес-задача, но `FR`/`NFR` выводит Phase 1 и помечает допущениями: апрувнутым набором они не считаются) - требования уже прогнаны оракулом, Phase 1 доверяет метке `quality-checks` и не дублирует полный обход.

Если аргумент не передан - агент интерактивно запрашивает постановку в первом сообщении.

## Output

Структурированный отчёт по фазам с .NET-специфичными деталями:

- **Phase 0:** обзор `.sln` / `.csproj` структуры, CPM, Directory.Build.props (если не greenfield)
- **Phase 1:** заполненные слоты Requirements + .NET-specific constraints (TFM, cloud target, опыт команды)
- **Phase 2:** таблица capacity (read/write QPS, storage, bandwidth, ratios)
- **Phase 3:** match с reference architecture + список адаптаций
- **Phase 4:** 2-3 альтернативы с конкретными .NET-инструментами и Mermaid-диаграммами
- **Phase 5:** выбранное решение + CAP/PACELC trade-off'ы (требует подтверждения)
- **Phase 6:** deep dive (EF Core schema, ASP.NET Core API, Redis cache, Polly resilience, Serilog/OpenTelemetry observability)
- **Phase 7:** implementation plan (walking skeleton WebApplication -> vertical slices -> scale-out)
- **Phase 8 (опционально):** ADR / C4 / architecture description

## Constraints

- Не предлагать решение до Capacity Estimation
- Минимум 2 жизнеспособных альтернативы
- Phase 5 требует explicit confirmation перед Deep Dive
- Не предлагать .NET Framework 4.x для greenfield - только .NET 8 LTS или новее
- Если задача явно НЕ-.NET - делегировать `architect` (стек-нейтральный)

Делегировать агенту `architect-dotnet` с **`mode: interactive`** во входе (команда исполняется главным циклом - канал к юзеру есть; без явного `interactive` агент уйдёт в дефолтный `autonomous` и не будет вести диалог/Phase 5 confirmation).
