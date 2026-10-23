---
description: Создание Architecture Decision Record (ADR) в формате MADR
allowed-tools: Read, Write, Grep, Glob
argument-hint: <title> (название решения)
---

# /adr

Создать ADR для архитектурного решения.

## Goal

Создать файл `{ключ adr}/ADR-{NUM}-{slug}.md` в формате MADR (каталог разрешает `adr-writer` через `dex-skill-project-docs-map:project-docs-map`). Автоматически определить следующий номер по существующим файлам.

## Input

Аргумент -- название решения. Если не указан -- спросить у пользователя.

Уточнить:
- Какую проблему решаем?
- Какие decision drivers (ограничения, требования)?
- Какие альтернативы рассматривали (минимум 2)?
- Почему выбрали этот вариант?
- Какие последствия (positive, negative, risks)?

## Output

Файл ADR с обязательными секциями:
- Status, Date
- Decision Drivers (минимум 2)
- Context
- Decision
- Consequences (Positive, Negative, Risks)
- Alternatives Considered (минимум 2, с pros/cons/why rejected)
- Links (связи с другими ADR)

Если ADR supersedes другой -- обновить Status старого ADR.

Делегировать агенту `adr-writer`.
