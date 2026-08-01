---
name: requirements-reviewer
description: >-
  Фикстура читателя норматива этапа - судит BRD, но норматив не грузит.
  Триггеры - ревью требований, приёмка BRD, судящий агент песочницы.
tools: Read, Grep, Glob, Skill
model: sonnet
---

# Requirements Reviewer (фикстура)

## Phase 1: Review

**Goal:** Отсудить набор требований против источника.

**Exit criteria:** По каждой оси набора есть блок находок либо явная пометка «чисто».
