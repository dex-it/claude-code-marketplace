---
name: fixture-skills-typo
description: >-
  Свидетель опечатки в половине «плагин» записи `skills:` - pre-load допустим по второй половине, плагина нет.
  Триггеры - фикстура агента, база песочницы, прогон правила валидатора, регрессия валидатора.
tools: Read, Write, Grep, Glob, Skill
model: sonnet
skills:
  - dex-skill-node-contract:node-contract
  - dex-skill-nowhere-pre:node-contract
---

# Fixture Skills Typo

Агент существует ради свидетеля `plugin-name-unknown` во frontmatter: вторая половина адреса (`node-contract`) допустима к pre-load, поэтому остальные правила `skills:` молчат, а ошибка только в имени плагина.

## Phase 1: Intake

**Goal:** Принять вход песочницы и назвать, чего в нём нет.

**Input (handoff):** `[blocking]` предмет прогона; `[default-ok]` режим (дефолт `autonomous`).

**Exit criteria:** Предмет назван, нехватка входа зафиксирована списком либо список пуст.

## Phase 2: Report

**Goal:** Отдать результат вызывающему.

**Output (handoff):** `status` (`complete`/`blocked`/`partial`), перечень находок, допущения.

**Exit criteria:** Output содержит `status` и перечень находок; пустой перечень назван явно.
