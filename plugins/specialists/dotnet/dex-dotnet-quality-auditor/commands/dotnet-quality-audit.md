---
description: Аудит гигиены качества .NET-проекта — анализаторы, warning-профиль, NuGet audit, NSDepCop, CI-gates. Отчёт «есть / нет / настроить».
allowed-tools: Read, Grep, Glob, Bash
argument-hint: "[путь к проекту/решению, опционально]"
---

# /dotnet-quality-audit

Проверить, какие средства контроля качества кода реально настроены в .NET-проекте, и подсветить недостающее с конкретной настройкой.

## Goal

Провести аудит по фазам агента `quality-auditor`: Context Gathering → Direct Analysis → Skill-Based Scan → Report. На выходе — actionable-картина «что настроено / чего нет / как настроить».

## Input

Аргумент — путь к репозиторию / решению. Если не передан — текущая рабочая директория.

## Output

- Таблица: `средство контроля | статус (вкл/выкл/частично/нет) | где найдено или почему нет | как настроить`
- Покрываются: Roslyn analyzers (`EnableNETAnalyzers`, `AnalysisMode`, `EnforceCodeStyleInBuild`), warning-профиль (`TreatWarningsAsErrors`, `CodeAnalysisTreatWarningsAsErrors`, `NoWarn`), NuGet security audit (`NuGetAudit`, `NuGetAuditMode`), NSDepCop (`config.nsdepcop`, severity), CI-gates (`dotnet format --verify-no-changes`, coverage threshold)
- Приоритет: 🔴 критично → 🟠 важно → 🟡 желательно
- Итог: «N из M средств настроено» + первые шаги

## Constraints

- Read-only — ничего не править в проекте, только отчёт
- Не утверждать «не настроено», не прочитав соответствующий манифест
- Дефолты, зависящие от версии SDK (NuGetAuditMode на .NET 8/9 vs 10), сверять с TFM проекта
- Не .NET-репозиторий — сообщить и остановиться

Делегировать агенту `quality-auditor`.
