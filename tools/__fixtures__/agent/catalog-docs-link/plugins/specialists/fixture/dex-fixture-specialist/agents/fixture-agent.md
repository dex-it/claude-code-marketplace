---
name: fixture-agent
description: >-
  Эталонный валидный агент песочницы - держит базу нулевых находок для раннера правил.
  Триггеры - фикстура агента, база песочницы, прогон правила валидатора, регрессия валидатора.
tools: Read, Write, Grep, Glob, Skill
model: sonnet
skills:
  - dex-skill-node-contract:node-contract
---

# Fixture Agent

Агент существует ради базы фикстур: содержание вторично, контракт фаз первичен.

## Phase 1: Intake

**Goal:** Принять вход песочницы и назвать, чего в нём нет.

**Input (handoff):** `[blocking]` предмет прогона; `[default-ok]` режим (дефолт `autonomous`).

**Exit criteria:** Предмет назван, нехватка входа зафиксирована списком либо список пуст.

## Phase 2: Report

**Goal:** Отдать результат вызывающему.

**Output (handoff):** `status` (`complete`/`blocked`/`partial`), перечень находок, допущения.

**Exit criteria:** Output содержит `status` и перечень находок; пустой перечень назван явно.

Порядок работ - [docs/pipelines/analytics/PIPELINE.md](https://github.com/dex-it/claude-code-marketplace/blob/main/docs/pipelines/analytics/PIPELINE.md).

Ограничения окружения - [CLI_UTILITIES](../docs/CLI_UTILITIES.md).

Пороги правил - `VALIDATOR_RULES.md`, имя названо код-спаном без ссылки.

## Молчащие адреса

Корпус пользователя, не документация каталога - `docs/product/GLOSSARY.md`.

Чужой файл, чьё имя оканчивается на имя нашего - `MY_CORPUS.md`.

Один документ, названный и путём `docs/VALIDATOR_RULES.md`, и голым именем выше - находка обязана
назвать его один раз, путём.

Только голым именем, ни разу путём - `FRAMEWORK_BARE.md`: имя дока каталога верхнего уровня
собирается отдельной веткой, и без такого случая её смерть прогон не покажет.
