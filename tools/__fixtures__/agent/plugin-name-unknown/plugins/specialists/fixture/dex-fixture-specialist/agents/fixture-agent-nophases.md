---
name: fixture-agent-nophases
description: >-
  Агент песочницы без секций фаз - держит ветку, где разбор фаз не проходит. Триггеры - фикстура агента без фаз,
  прогон правила валидатора, регрессия валидатора, песочница без фаз.
tools: Read, Write, Grep, Glob, Skill
model: sonnet
skills:
  - dex-skill-node-contract:node-contract
---

# Fixture Agent Without Phases

Секций фаз нет, поэтому `skill-reference-unknown` на теле не запускается. Скилл-плагин, которого нет: `dex-skill-nowhere-nophase:x` - здесь его судит `plugin-name-unknown`.
