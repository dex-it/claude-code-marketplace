---
description: Pre-push саморевью своей локальной ветки включая незакоммиченные изменения - 7 фокусов с реальным прогоном build/test, чеклист правок до push
allowed-tools: Read, Grep, Glob, Bash, Skill
argument-hint: "[base-branch, по умолчанию origin/main или origin/develop]"
---

# /self-review

Запустить саморевью текущей локальной ветки перед push: поймать то, что иначе ловит CI, ревьюер или прод.

## Goal

Провести ветку через фазы агента `self-reviewer`: Capture Diffs, Domain Recall, Change Map, Parallel 7-Focus Scan, Falsification, Assemble Round, Report.

## Input

Опциональный аргумент - базовая ветка для сравнения (по умолчанию определяется по upstream: origin/main или origin/develop). Ревьюится дельта от базы с учётом committed, staged и worktree.

## Output

- Результаты Local verification (build, типы, линтер, тесты, audit) с фактическим выводом команд
- Чеклист правок до push с метками 🟢🟡🟠🔴🟣, разделённый на блокеры / важные / замечания / мелочи
- Подозрения для перепроверки (confidence ниже 80) отдельным разделом

## Constraints

- Незакоммиченные изменения (staged и worktree) ревьюятся наравне с закоммиченными
- TODO, заглушки, fallback, моки в проде, debug-print, .only, disabled-тесты, hardcoded secrets - всегда блокер или важное
- До команды `делай` рабочее дерево не меняется; `пушь` разрешён только при зелёном Local verification и отсутствии 🔴
- Незакоммиченный worktree перед push выносится явно (commit/stash/discard), решение за автором

Команды цикла: `делай` (исправить пункт), `ещё раз` (новый проход по дельте), `пушь` (push после зелёного чеклиста). Делегировать агенту `self-reviewer`.
