---
description: Реализация фичи по ТЗ до локальных коммитов без push - декомпозиция в требования, дизайн, edit-план, пошаговая правка с локальной верификацией
allowed-tools: Read, Edit, Write, Bash, Grep, Glob, Skill
argument-hint: "<ТЗ или ссылка на тикет> [base-branch] [feature-branch]"
---

# /implement

Реализовать фичу по ТЗ в стиле проекта, без долгов и хвостов. Финиш - готовые локальные коммиты; push и саморевью отдельно.

## Goal

Провести фичу через универсальный цикл движка (адаптация под проект, режим `оформляй`/`делай`/`стоп`)
и фазы трека `dex-skill-development-track:development-track`: Decompose Spec, Architecture Inventory,
Research Unknowns, Design, Executable Edit Plan, Falsify Plan, Implement with Verify, Final
Self-Verification.

## Input

Аргумент - ТЗ в свободной форме или ссылка на тикет. Опционально base-branch и feature-branch (если ветки нет, её создание входит в план). Стек определяется по манифестам проекта.

## Output

- Требования R/I, success criteria, non-goals, вопросы перед стартом
- Архитектурное решение и edit-план P1..Pn с локальной проверкой каждой правки
- После команды `делай` - серия локальных коммитов, по одной правке за раз с верификацией
- Финальный отчёт: success criteria, результат полного прогона, закрытые R/I; push не сделан

## Constraints

- Скоуп равен ТЗ; замеченное рядом - в открытые наблюдения, не в эту фичу
- Запрещены TODO, заглушки, silent fallback, debug-вывод, hardcoded secrets, отключённые тесты, спекулятивный код, дубли утилит
- Confidence ниже 80 в трактовке или подходе - вопрос, не код
- Промт заканчивается на локальных коммитах: ни push, ни MR, ни merge

Команды цикла: `оформляй` (полный план), `делай` (исполнение по одной правке), `стоп` (прекратить).
Следующий шаг - `/self-review`. Вызови `Skill` -> `dex-sdlc:engine` (откроет/возобновит цикл, авто-
ledger с треком `dex-skill-development-track:development-track`, ведёт цикл команд
`оформляй`/`делай`/`стоп` как механизм режима), затем `Skill` ->
`dex-skill-development-track:development-track` с **`mode: interactive`** - без этого поля трек
работает как узел (`autonomous`) и цикла команд не будет.
