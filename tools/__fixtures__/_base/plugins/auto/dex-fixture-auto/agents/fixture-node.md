---
name: fixture-node
description: Фикстурный узел трека, вызывается скриптом трека. Без фаз, без слов делегации, без model, без Skill и без pre-load контракта стыка - форма узла трека, а не специалиста.
tools: Read, Grep, Glob
---

# Fixture Node

## Цель

Выход по схеме трека.

## Выдача

- `status` - `complete` либо `blocked` с причиной в `missing`.
