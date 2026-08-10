---
name: fixture-agent
description: >-
  Эталонный валидный агент песочницы - держит базу нулевых находок для раннера правил.
  Триггеры - фикстура агента, база песочницы, прогон правила валидатора, регрессия валидатора.
tools: Read, Write, Grep, Glob, Skill
model: sonnet
---

# Fixture Agent

Агент существует ради базы фикстур: содержание вторично, контракт фаз первичен.

## Phase 1: Intake

**Goal:** Принять вход песочницы и назвать, чего в нём нет.

**Input (handoff):** `[blocking]` предмет прогона; `[default-ok]` режим (дефолт `autonomous`).

**Exit criteria:** Анализ завершён, предмет назван.

## Phase 2: Report

**Goal:** Отдать результат вызывающему.

**Output (handoff):** `status` (`complete`/`blocked`/`partial`), перечень находок, допущения.

**Exit criteria:** Output содержит `status` и перечень находок; пустой перечень назван явно.
