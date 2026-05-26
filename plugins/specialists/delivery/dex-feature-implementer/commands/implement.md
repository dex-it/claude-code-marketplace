---
description: Реализация фичи по ТЗ до локальных коммитов без push — декомпозиция в требования, дизайн, edit-план, пошаговая правка с локальной верификацией
allowed-tools: Read, Edit, Write, Bash, Grep, Glob, Skill, Agent
argument-hint: "<ТЗ или ссылка на тикет> [base-branch] [feature-branch]"
---

# /implement

Реализовать фичу по ТЗ в стиле проекта, без долгов и хвостов. Финиш — готовые локальные коммиты; push и саморевью отдельно.

## Goal

Провести фичу через фазы агента `feature-implementer`: Project Conventions, Decompose Spec, Architecture Inventory, Research Unknowns, Design, Executable Edit Plan, Falsify Plan, Implement with Verify, Final Self-Verification.

## Input

Аргумент — ТЗ в свободной форме или ссылка на тикет. Опционально base-branch и feature-branch (если ветки нет, её создание входит в план). Стек определяется по манифестам проекта.

## Output

- Требования R/I, success criteria, non-goals, вопросы перед стартом
- Архитектурное решение и edit-план P1..Pn с локальной проверкой каждой правки
- После команды `делай` — серия локальных коммитов, по одной правке за раз с верификацией
- Финальный отчёт: success criteria, результат полного прогона, закрытые R/I; push не сделан

## Constraints

- Скоуп равен ТЗ; замеченное рядом — в открытые наблюдения, не в эту фичу
- Запрещены TODO, заглушки, silent fallback, debug-вывод, hardcoded secrets, отключённые тесты, спекулятивный код, дубли утилит
- Confidence ниже 80 в трактовке или подходе — вопрос, не код
- Промт заканчивается на локальных коммитах: ни push, ни MR, ни merge

Команды цикла: `оформляй` (полный план), `делай` (исполнение по одной правке), `стоп` (прекратить). Следующий шаг — `/self-review`. Делегировать агенту `feature-implementer`.
