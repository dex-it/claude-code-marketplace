---
name: requirements-reviewer
description: >-
  Фикстура читателя норматива этапа - судит BRD, но норматив не грузит.
  Триггеры - ревью требований, приёмка BRD, судящий агент песочницы.
tools: Read, Grep, Glob, Skill
model: sonnet
skills:
  - dex-skill-node-contract:node-contract
---

# Requirements Reviewer (фикстура)

## Phase 1: Review

**Goal:** Отсудить набор требований против источника.

**Input (handoff):** `[blocking]` набор требований под суд; `[default-ok]` режим (дефолт `autonomous`).

**Output (handoff):** `status` (`complete`/`blocked`/`partial`), находки по осям набора, вердикт.

**Exit criteria:** По каждой оси набора есть блок находок либо явная пометка «чисто».
