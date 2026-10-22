---
name: requirements-reviewer
description: >-
  Фикстура читателя норматива этапа - норматив называет, но Skill в tools нет.
  Триггеры - ревью требований, приёмка BRD, судящий агент песочницы без Skill.
tools: Read, Grep, Glob
model: sonnet
skills:
  - dex-skill-node-contract:node-contract
---

# Requirements Reviewer (фикстура без Skill)

## Phase 1: Review

**Goal:** Отсудить BRD против норматива этапа.

**Input (handoff):** `[blocking]` BRD под суд; `[default-ok]` режим (дефолт `autonomous`).

**Output (handoff):** `status` (`complete`/`blocked`/`partial`), находки по составу BRD, вердикт.

**Exit criteria:** Состав BRD сверен с нормативами dex-skill-business-analysis-29148:business-analysis-29148, dex-skill-system-requirements-29148:system-requirements-29148, dex-skill-use-cases-cockburn:use-cases-cockburn (все нормативы читателя по `STAGE_NORMATIVE_READERS`, иначе этот агент закрывает и первый шаблон); по каждому разделу есть находка либо пометка «чисто».
