---
name: orphan-agent
description: >-
  Фикстурный агент песочницы, стоящий в dependencies[] и называющий только сам себя.
  Триггеры - проба самоссылки, запись без тянущего ребра, обратная сторона замыкания, песочница.
tools: Read, Grep, Glob, Skill
model: sonnet
skills:
  - dex-skill-node-contract:node-contract
---

# Orphan Agent

Агент существует ради одной пробы: он в `dependencies[]` и называет только собственный плагин
`dex-fixture-orphan-specialist:orphan-agent`. Своё имя ребром не считается, иначе запись тянула бы
сама себя и правило молчало бы всегда.

## Phase 1: Intake

**Goal:** Принять вход песочницы и назвать, чего в нём нет.

**Exit criteria:** Предмет назван, нехватка входа зафиксирована списком либо список пуст.

## Phase 2: Report

**Goal:** Отдать результат вызывающему.

**Output (handoff):** `status` (`complete`/`blocked`/`partial`), перечень находок, допущения.

**Exit criteria:** Output содержит `status` и перечень находок; пустой перечень назван явно.
