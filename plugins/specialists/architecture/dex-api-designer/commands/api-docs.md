---
description: Проектирование API и генерация OpenAPI/AsyncAPI/proto спецификаций
allowed-tools: Read, Write, Edit, Grep, Glob
argument-hint: "[action] (generate | validate | diff)"
---

# /api-docs

Проектирование API и работа со спецификациями.

## Goal

В зависимости от action:
- **generate** -- спроектировать API и сгенерировать спецификацию (OpenAPI, AsyncAPI, proto)
- **validate** -- проверить существующую спецификацию на полноту и консистентность
- **diff** -- сравнить две версии спецификации и выявить breaking changes

Без аргумента -- интерактивный режим, уточнить действие у пользователя.

## Input для generate

Уточнить:
- Какие ресурсы/операции нужно expose?
- Для каких потребителей (frontend, mobile, другие сервисы)?
- Характер операций (CRUD, streaming, events)?
- Аутентификация (JWT, API Key, OAuth2)?
- Нужна ли версионность?

## Output

- **generate**: спецификация в выбранном формате (OpenAPI YAML, GraphQL SDL, proto, AsyncAPI YAML)
- **validate**: отчёт с найденными проблемами -- отсутствующие descriptions, невалидные examples, unused schemas
- **diff**: список изменений с пометкой breaking/non-breaking

## Breaking changes (для diff)

Считать breaking: удаление endpoint, изменение типа параметра, добавление required параметра, изменение response schema.

Делегировать агенту `api-designer`.
