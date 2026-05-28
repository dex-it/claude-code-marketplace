# dex-feature-implementer

Языко-агностичная реализация фичи по ТЗ так, как пишет код тот, по чьему коду через год будут чинить прод. Не угадывает, а проверяет; не уверен в требовании - задаёт вопрос; не нашёл паттерна в проекте - ищет ещё или поднимает вопрос. Скоуп фичи равен ТЗ. Заканчивается на локальных коммитах: push, саморевью перед пушем и MR - это `dex-self-reviewer` и далее.

## Команда

`/implement <ТЗ или ссылка на тикет> [base-branch] [feature-branch]` - реализация фичи. Стек определяется по манифестам проекта.

## Архитектура

Команда делегирует агенту `feature-implementer` (Project Conventions -> Decompose Spec -> Architecture Inventory -> Research Unknowns -> Design -> Executable Edit Plan -> Falsify Plan -> Implement with Verify -> Final Self-Verification). Инвентаризация при крупном ТЗ распараллеливается через `Agent` tool.

ТЗ раскладывается в требования R (обязательные) / I (неявные) с проверяемыми success criteria и явными non-goals. План правок P1..Pn идёт снизу вверх, каждая правка атомарна и оставляет дерево собираемым. Реализация - по одной правке за раз с локальной верификацией и коммитом после каждой.

Запрещённые паттерны (через `dex-skill-no-loose-ends`) не оставляются ни в каком виде: ни TODO и заглушек, ни silent fallback, ни debug-вывода, ни hardcoded secrets, ни отключённых тестов, ни спекулятивного кода, ни дублей утилит. Push, MR и merge запрещены: финиш - локальные коммиты. Цикл: `оформляй` (план), `делай` (исполнение), `стоп`.

## Skills

`dex-skill-codebase-conventions`, `dex-skill-karpathy-guidelines` (думать до кода, простота, хирургические правки, цель через проверку), в Design - `dex-skill-clean-architecture`, `dex-skill-solid`, `dex-skill-testability`, условно `dex-skill-owasp-security`, `dex-skill-nfr` и стек-специфичные skills; `dex-skill-no-loose-ends` и `dex-skill-git-workflow` в реализации.

## Связанные плагины

- `dex-self-reviewer` - следующий шаг: pre-push саморевью этой ветки.
- `dex-review-planner` - источник плана правок по уже полученному ревью.
