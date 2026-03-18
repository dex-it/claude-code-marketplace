---
description: Генерация и валидация OpenAPI/Swagger документации
allowed-tools: Bash, Read, Write, Grep, Glob
---

# /api-docs

Генерация и валидация OpenAPI/Swagger документации.

## Использование

```
/api-docs generate            # Сгенерировать OpenAPI spec
/api-docs validate            # Валидировать существующий spec
/api-docs diff                # Сравнить версии API
/api-docs export [format]     # Экспорт в JSON/YAML
```

## Процесс

### 1. Валидация спецификации

```bash
# Используя spectral (npm install -g @stoplight/spectral-cli)
spectral lint openapi.yaml

# Или Redocly CLI (npm install -g @redocly/cli)
redocly lint openapi.yaml
```

**Типичные проблемы:**

| Код | Описание | Решение |
|-----|----------|---------|
| oas3-valid-schema-example | Неверный example | Исправить example в spec |
| operation-operationId | Нет operationId | Добавить operationId |
| oas3-unused-component | Неиспользуемая схема | Удалить или использовать |

### 2. Сравнение версий API

```bash
# Используя oasdiff (https://github.com/Tufin/oasdiff)
oasdiff diff openapi-v1.yaml openapi-v2.yaml

# Breaking changes
oasdiff breaking openapi-v1.yaml openapi-v2.yaml
```

**Breaking changes to watch:**
- Удаление endpoint
- Изменение типа параметра
- Добавление required параметра
- Изменение response schema

### 3. Генерация документации

```bash
# Redocly — красивый HTML из OpenAPI
redocly build-docs openapi.yaml -o docs/api.html

# Swagger UI — интерактивный sandbox
# Доступен через фреймворк (ASP.NET, FastAPI, NestJS и др.)
```

## Выходной формат

```
OpenAPI Documentation Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Source: openapi.yaml
Version: 1.0.0

Endpoints discovered: N
Schemas: M

Validation: ✅ Passed (0 errors, 2 warnings)

Next steps:
1. Review generated documentation
2. Add missing descriptions
3. Fix validation warnings
4. Publish to API portal
```

## Интеграция

- **GitLab/GitHub:** Добавить openapi.yaml в репозиторий
- **CI/CD:** Линтинг spectral/redocly в pipeline
- **SDK:** Генерация клиентских SDK (openapi-generator, NSwag, orval)
