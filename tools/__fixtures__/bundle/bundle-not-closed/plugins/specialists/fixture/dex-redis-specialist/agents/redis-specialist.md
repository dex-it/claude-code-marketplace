---
name: redis-specialist
description: >-
  Фикстурный специалист по стеку - делит сегмент имени с профильным скиллом, поэтому грузит его всегда.
  Триггеры - фикстура специалиста стека, предмет потребителя, проба исключения by-stack, замыкание по стеку.
tools: Read, Write, Grep, Glob, Skill
model: sonnet
---

# Redis Specialist

Агент существует ради ребра замыкания: стек скилла - его собственный предмет.

## Phase 1: Intake

В фазе грузится `dex-skill-redis:redis`.

**Goal:** Принять вход песочницы и назвать, чего в нём нет.

**Input (handoff):** `[blocking]` предмет прогона; `[default-ok]` режим (дефолт `autonomous`).

**Exit criteria:** Предмет назван, нехватка входа зафиксирована списком либо список пуст.

## Phase 2: Report

**Goal:** Отдать результат вызывающему.

**Output (handoff):** `status` (`complete`/`blocked`/`partial`), перечень находок, допущения.

**Exit criteria:** Output содержит `status` и перечень находок; пустой перечень назван явно.
