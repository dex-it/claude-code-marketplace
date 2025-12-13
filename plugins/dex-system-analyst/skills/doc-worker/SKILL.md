---
name: doc-worker
description: Универсальный инструмент для работы с документацией в любых современных системах (Confluence, Notion, GitBook, MkDocs). Поддерживает иерархию документов, перекрестные ссылки, шаблоны и форматирование. Триггеры - документация, документ, docs, wiki, knowledge base.
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, AskUserQuestion
---

# Doc Worker — Universal Documentation Management Skill

## Краткое описание

Универсальный skill для работы с технической документацией в различных системах. Автоматически адаптируется к доступной платформе документирования или запрашивает у пользователя.

**Поддерживаемые платформы:**
- **Wiki-системы:** Confluence, MediaWiki, DokuWiki
- **Cloud platforms:** Notion, GitBook, ReadTheDocs
- **Static generators:** MkDocs, Docusaurus, VuePress, Hugo, Jekyll
- **Локальные файлы:** Markdown в Git-репозиториях, файловая система

**Фокус:** Структура, иерархия, перекрестные ссылки, шаблоны, контроль качества документации.

## Определение платформы документирования

### Автоматическое определение

При активации skill автоматически проверяет:

1. **Доступные MCP серверы:**
   - Confluence MCP → использовать Confluence API
   - Notion MCP → использовать Notion API
   - Custom doc MCP → использовать его API

2. **Файловая система проекта:**
   - `mkdocs.yml` → MkDocs проект
   - `docusaurus.config.js` → Docusaurus
   - `docs/` папка с .md файлами → Generic Markdown
   - `.vuepress/` → VuePress
   - `_config.yml` + `_posts/` → Jekyll

3. **Переменные окружения:**
   - `${CONFLUENCE_URL}` → Confluence
   - `${NOTION_API_KEY}` → Notion
   - `${GITBOOK_API_TOKEN}` → GitBook

### Запрос у пользователя

Если платформа не определена автоматически:

```
❓ Где находится ваша документация?

1. Confluence (требуется MCP сервер или URL)
2. Notion (требуется API key)
3. GitBook
4. Markdown файлы в проекте (укажите путь: docs/, documentation/, etc.)
5. MkDocs проект
6. Другое (укажите детали)
```

## Основные принципы работы

### 1. Search-First подход
- **Всегда искать существующий контент перед созданием нового**
- Предотвращение дублирования документов
- Поиск по: title, content, tags, metadata, path hierarchy

### 2. Структура и иерархия
- **Поддержка древовидной структуры документов**
- Parent-child отношения (папки/страницы)
- Breadcrumbs и навигация
- Table of Contents (TOC) автогенерация

### 3. Управление перекрестными ссылками
- **Автоматическое обнаружение связанных документов**
- При упоминании ключевой сущности/термина автоматически искать существующие документы
- Предлагать варианты при множественных совпадениях
- Валидация и обновление ссылок при переименовании/перемещении
- Использование устойчивых идентификаторов (ID-based links, slugs)
- Показывать метрику релевантности пользователю (0-1)

### 4. Версионирование и изменения
- **Подтверждение значительных изменений с автором/владельцем**
- История изменений (changelog)
- Diff preview перед публикацией
- Merge существующих страниц вместо создания новых

## Универсальные операции

### Базовые операции

Skill адаптирует эти операции к конкретной платформе:

#### `search(query, options)`
Поиск документов по запросу.

**Примеры использования:**
```
# Confluence (через MCP)
confluence.search({ query: "API integration", spaces_filter: "DEV" })

# Markdown в файловой системе
grep -r "API integration" docs/
find docs/ -name "*api*integration*.md"

# MkDocs
поиск в docs/ с учетом mkdocs.yml navigation

# Notion (через MCP если доступен)
notion.search({ query: "API integration", filter: {...} })
```

**Параметры (универсальные):**
- `query` — поисковый запрос
- `path` — область поиска (space/folder/database)
- `tags` — фильтр по меткам
- `dateRange` — диапазон дат изменения
- `limit` — максимум результатов

#### `create(document)`
Создание нового документа.

**Confluence:**
```typescript
mcp.confluence.createPage({
  space_key: "DEV",
  title: "API Documentation",
  parent_id: "123456",
  content: markdownContent,
  content_format: "markdown"
})
```

**Markdown (файловая система):**
```bash
# Создать файл docs/api/authentication.md
cat > docs/api/authentication.md <<EOF
---
title: Authentication API
date: 2025-01-15
tags: [api, auth]
---

# Authentication API
...
EOF
```

**MkDocs:**
```bash
# Создать файл + обновить mkdocs.yml navigation
# docs/api/authentication.md + mkdocs.yml
```

**Параметры (универсальные):**
- `title` — заголовок документа
- `parentPath` или `parentId` — родительский документ
- `content` — содержимое
- `format` — markdown, html, asciidoc, rst
- `tags` — метки
- `metadata` — дополнительные метаданные

#### `update(documentRef, changes)`
Обновление существующего документа.

**Confluence:**
```typescript
mcp.confluence.updatePage({
  page_id: "123456",
  title: "Updated Title",
  content: updatedContent,
  version_comment: "Added examples section"
})
```

**Markdown:**
```bash
# Редактировать файл docs/api/auth.md
# Использовать Edit tool
```

**Параметры:**
- `documentRef` — ID, path или URL документа
- `title` — новый заголовок (опционально)
- `content` — новое содержимое
- `append` — добавить в конец вместо замены
- `versionComment` — комментарий к версии

#### `move(documentRef, newParent)`
Перемещение документа в иерархии.

**Confluence:**
```typescript
# Обновить parent_id страницы
```

**Markdown:**
```bash
# Переместить файл + обновить все ссылки на него
mv docs/old-path/doc.md docs/new-path/doc.md
# Обновить ссылки во всех файлах
```

### Работа с иерархией

#### `getHierarchy(rootPath, depth)`
Получение структуры документов.

**Confluence:**
```typescript
// Получить дерево страниц через getPageChildren рекурсивно
```

**Markdown/MkDocs:**
```bash
tree docs/ -L 3
# Или парсинг mkdocs.yml navigation
```

**Возвращает:**
```
docs/
├── api/
│   ├── authentication.md
│   ├── users.md
│   └── payments.md
├── guides/
│   ├── getting-started.md
│   └── deployment.md
└── reference/
    └── glossary.md
```

#### `getBreadcrumbs(documentRef)`
Получение пути к документу.

**Пример вывода:**
```
Home > API Documentation > Authentication > OAuth 2.0
```

### Управление перекрестными ссылками

#### Автоматическое обнаружение связей

При создании или редактировании документа:

```typescript
// Пример: В тексте упоминается "payment service"
const content = `
When processing transactions, our payment service validates...
`;

// 1. Извлечь ключевые сущности/термины
const entities = extractEntities(content); // ["payment service", "transactions"]

// 2. Для каждой сущности найти связанные документы
for (const entity of entities) {
  const related = await search(entity, { limit: 5 });

  if (related.length > 0) {
    const bestMatch = related[0];
    const relevance = calculateRelevance(entity, bestMatch);

    if (relevance > 0.7) {
      console.log(`💡 Предложить ссылку:`);
      console.log(`   "${entity}" -> "${bestMatch.title}"`);
      console.log(`   Релевантность: ${relevance.toFixed(2)}`);
      console.log(`   Причина: совпадение по тегам [${bestMatch.tags.join(', ')}]`);

      // Спросить пользователя
      const addLink = await askUser({
        question: `Добавить ссылку на "${bestMatch.title}"?`,
        options: ["Да", "Нет", "Показать другие варианты"]
      });
    }
  }
}
```

#### Валидация ссылок

```typescript
async function validateLinks(documentRef) {
  const doc = await getDocument(documentRef);
  const links = extractLinks(doc.content);

  const results = {
    valid: [],
    broken: [],
    suggestions: []
  };

  for (const link of links) {
    if (link.type === 'internal') {
      const exists = await documentExists(link.target);

      if (!exists) {
        results.broken.push(link);

        // Попытаться найти похожий документ
        const similar = await search(link.text, { limit: 3 });
        if (similar.length > 0) {
          results.suggestions.push({
            broken: link,
            alternatives: similar
          });
        }
      } else {
        results.valid.push(link);
      }
    } else if (link.type === 'external') {
      // Можно проверить HTTP статус (опционально)
      results.valid.push(link);
    }
  }

  return results;
}
```

**Вывод для пользователя:**
```
✅ Валидные ссылки: 15
❌ Битые ссылки: 2

Битые ссылки:
1. "[Old Feature](docs/features/old-feature.md)"
   💡 Возможно имелось в виду:
      - "New Feature Documentation" (релевантность: 0.85)
      - "Feature Migration Guide" (релевантность: 0.72)

2. "[Setup Guide](../setup.md)"
   ❌ Документ не найден
```

#### Обновление ссылок при перемещении

```typescript
async function moveDocument(docPath, newPath) {
  // 1. Переместить документ
  await moveFile(docPath, newPath);

  // 2. Найти все документы, которые ссылаются на него
  const references = await findReferences(docPath);

  console.log(`📝 Обновление ссылок в ${references.length} документах...`);

  for (const ref of references) {
    // 3. Обновить ссылку в каждом документе
    await updateLinksInDocument(ref.path, {
      from: docPath,
      to: newPath
    });

    console.log(`   ✓ ${ref.path}`);
  }

  console.log(`✅ Перемещение завершено. Обновлено ${references.length} ссылок.`);
}
```

## Работа с шаблонами

### Встроенные шаблоны

Skill предоставляет готовые шаблоны для типовых документов:

#### 1. API Documentation Template

```markdown
---
title: {API_NAME} API v{VERSION}
type: api-reference
tags: [api, {TAGS}]
---

# {API_NAME} API v{VERSION}

## Overview
{DESCRIPTION}

**Base URL:** `{BASE_URL}`
**Authentication:** {AUTH_TYPE}

## Endpoints

### {METHOD} {ENDPOINT}
{ENDPOINT_DESCRIPTION}

**Request:**
\`\`\`json
{REQUEST_EXAMPLE}
\`\`\`

**Response:**
\`\`\`json
{RESPONSE_EXAMPLE}
\`\`\`

**Status Codes:**
- `200 OK` — Success
- `400 Bad Request` — Invalid parameters
- `401 Unauthorized` — Authentication required
- `404 Not Found` — Resource not found

## Error Handling
{ERROR_HANDLING}

## Rate Limiting
{RATE_LIMITS}

## Examples
{EXAMPLES}

## Changelog
| Version | Date       | Changes                    |
|---------|------------|----------------------------|
| {VERSION} | {DATE}   | Initial release           |
```

#### 2. Architecture Decision Record (ADR)

```markdown
---
title: ADR-{NUMBER}: {TITLE}
type: adr
status: {STATUS}
date: {DATE}
tags: [adr, architecture]
---

# ADR-{NUMBER}: {TITLE}

**Date:** {DATE}
**Status:** {STATUS} (Proposed | Accepted | Deprecated | Superseded)
**Deciders:** {DECIDERS}

## Context
What is the issue that we're seeing that is motivating this decision or change?

{CONTEXT}

## Decision
What is the change that we're proposing and/or doing?

{DECISION}

## Consequences
What becomes easier or more difficult to do because of this change?

### Positive
{POSITIVE_CONSEQUENCES}

### Negative
{NEGATIVE_CONSEQUENCES}

## Alternatives Considered
What other options did we consider?

{ALTERNATIVES}

## References
- {REFERENCE_1}
- {REFERENCE_2}
```

#### 3. User Story Template

```markdown
---
title: {STORY_TITLE}
type: user-story
epic: {EPIC_NAME}
priority: {PRIORITY}
tags: [user-story, {TAGS}]
---

# User Story: {STORY_TITLE}

**As a** {USER_ROLE}
**I want** {GOAL}
**So that** {BENEFIT}

## Acceptance Criteria

**Given** {PRECONDITION}
**When** {ACTION}
**Then** {EXPECTED_RESULT}

### Criteria 1
- [ ] {CRITERION_1}

### Criteria 2
- [ ] {CRITERION_2}

## Technical Notes
{TECHNICAL_DETAILS}

## Dependencies
- {DEPENDENCY_1}
- {DEPENDENCY_2}

## Estimation
**Story Points:** {POINTS}
**Priority:** {PRIORITY}
```

#### 4. Runbook Template

```markdown
---
title: {SERVICE_NAME} Runbook
type: runbook
service: {SERVICE_NAME}
tags: [runbook, operations, {SERVICE_NAME}]
---

# {SERVICE_NAME} Runbook

## Service Overview
{DESCRIPTION}

**Owner:** {TEAM_NAME}
**On-call:** {ON_CALL_CONTACT}

## Quick Links
- Monitoring: {MONITORING_URL}
- Logs: {LOGS_URL}
- Metrics: {METRICS_URL}

## Common Issues

### Issue: {ISSUE_NAME}
**Symptoms:** {SYMPTOMS}

**Diagnosis:**
\`\`\`bash
{DIAGNOSTIC_COMMANDS}
\`\`\`

**Resolution:**
1. {STEP_1}
2. {STEP_2}
3. {STEP_3}

**Root Cause:** {ROOT_CAUSE}

## Deployment

### Deploy to Production
\`\`\`bash
{DEPLOYMENT_COMMANDS}
\`\`\`

### Rollback
\`\`\`bash
{ROLLBACK_COMMANDS}
\`\`\`

## Monitoring & Alerts

### Key Metrics
- {METRIC_1}: {THRESHOLD}
- {METRIC_2}: {THRESHOLD}

### Alert Response
**Alert:** {ALERT_NAME}
**Severity:** {SEVERITY}
**Action:** {ACTION}

## Contacts
- Team: {TEAM_CONTACT}
- Escalation: {ESCALATION_CONTACT}
```

#### 5. Release Notes Template

```markdown
---
title: Release {VERSION} — {RELEASE_NAME}
type: release-notes
version: {VERSION}
date: {DATE}
tags: [release, v{VERSION}]
---

# Release {VERSION} — {RELEASE_NAME}

**Release Date:** {DATE}
**Type:** Major | Minor | Patch

## Summary
{SUMMARY}

## New Features ✨
- **{FEATURE_1}:** {DESCRIPTION}
- **{FEATURE_2}:** {DESCRIPTION}

## Improvements 🚀
- {IMPROVEMENT_1}
- {IMPROVEMENT_2}

## Bug Fixes 🐛
- {BUG_FIX_1}
- {BUG_FIX_2}

## Breaking Changes ⚠️
- {BREAKING_CHANGE_1}
  - **Migration:** {MIGRATION_STEPS}

## Deprecated 📛
- {DEPRECATED_FEATURE}
  - **Alternative:** {ALTERNATIVE}

## Dependencies
Updated dependencies:
- {DEPENDENCY_1}: {OLD_VERSION} → {NEW_VERSION}

## Upgrade Instructions
\`\`\`bash
{UPGRADE_COMMANDS}
\`\`\`

## Known Issues
- {KNOWN_ISSUE_1}

## Contributors
Thanks to all contributors:
- {CONTRIBUTOR_1}
- {CONTRIBUTOR_2}
```

### Использование шаблонов

```typescript
// Применение шаблона
const content = applyTemplate('api-documentation', {
  API_NAME: 'User Authentication',
  VERSION: '2.0',
  BASE_URL: 'https://api.example.com/v2/auth',
  AUTH_TYPE: 'JWT Bearer Token',
  TAGS: 'auth, security',
  // ... другие переменные
});

// Создание документа из шаблона
await create({
  title: 'User Authentication API v2.0',
  content: content,
  path: 'api-reference/authentication'
});
```

## Стандарты форматирования

### Универсальная структура документа

```markdown
---
title: Document Title
date: YYYY-MM-DD
author: Author Name
tags: [tag1, tag2, tag3]
status: draft | review | published
---

# Document Title

**Summary:** Brief one-sentence description

**Last Updated:** YYYY-MM-DD
**Author:** Author Name

## Table of Contents
[Auto-generated or manual]

## Context / Overview
Why this document exists, what problem it solves

## Main Content
[Structured sections with clear hierarchy]

### Section 1
Content...

### Section 2
Content...

## Examples
Practical examples, code snippets, configurations

## Related Documents
- [Related Doc 1](link)
- [Related Doc 2](link)

## References
External links, sources, additional reading

## Changelog
| Date       | Changes                    | Author      |
|------------|----------------------------|-------------|
| 2025-01-15 | Initial version           | John Doe    |
```

### Иерархия заголовков

- **H1 (`#`):** Заголовок документа (один на документ)
- **H2 (`##`):** Основные разделы
- **H3 (`###`):** Подразделы
- **H4-H6:** Детальные подразделы (использовать умеренно)

### Форматирование кода

````markdown
**Inline code:** `variable` или `function()`

**Code blocks:**
```python
def example():
    return "Hello, World!"
```

**Shell commands:**
```bash
npm install
docker build -t myapp .
```

**Configuration files:**
```yaml
server:
  port: 8080
  host: localhost
```
````

### Таблицы

```markdown
| Column 1     | Column 2  | Column 3  |
|--------------|-----------|-----------|
| Value 1      | Value 2   | Value 3   |
| Value 4      | Value 5   | Value 6   |
```

### Ссылки

**Внутренние ссылки (адаптируются к платформе):**

```markdown
# Confluence (ID-based)
[Document Title](pageId:123456)

# Markdown (относительные пути)
[Document Title](../other-docs/document.md)
[Section](../other-docs/document.md#section-name)

# Notion (block IDs)
[Document Title](notion://...)
```

**Внешние ссылки:**
```markdown
[External Resource](https://example.com)
```

### Callouts и блоки внимания

```markdown
> **Note:** Important information to consider

> **Warning:** Critical warning or caution

> **Tip:** Helpful tip or best practice

> **Deprecated:** This feature is deprecated, use X instead
```

## Управление дублированием контента

### Поведение при обнаружении похожих документов

1. **Сначала поиск:** Всегда выполнять поиск перед созданием
2. **Предложить варианты:**
   - ✅ **Предпочтительно:** Обновить существующий документ
   - ✅ Создать дочерний документ со ссылкой на родительский
   - ✅ Объединить (merge) документы с согласия автора
   - ❌ **Избегать:** Создание дублирующего документа

3. **Исключения для создания нового:**
   - Разные пространства/папки
   - Разные аудитории
   - Разные версии продукта

### Алгоритм обработки

```
При создании документа "{TITLE}":
│
├─ Выполнить поиск похожих: search("{TITLE}", {tags, path})
│
├─ Найдены похожие (similarity > 0.7)?
│  │
│  ├─ ДА → Показать пользователю:
│  │      "Найдены похожие документы:
│  │       1. {TITLE_1} (релевантность: 0.95)
│  │       2. {TITLE_2} (релевантность: 0.82)
│  │
│  │       Что делать?
│  │       [ ] Обновить документ #1
│  │       [ ] Создать как дочерний документ к #1
│  │       [ ] Создать новый (укажите причину)"
│  │
│  └─ НЕТ → Создать новый документ
│
└─ Создать документ + Добавить метаданные
```

## Права доступа и безопасность

### Общие правила

1. **Credentials:** Требуются права на чтение/запись в системе документирования
2. **Logging:** Никогда не логировать токены, пароли, конфиденциальные данные
3. **Подтверждения:** Запрашивать подтверждение для:
   - Массового изменения документов (>5)
   - Удаления документов
   - Перемещения документов
4. **Visibility:** Соблюдать настройки видимости (public/private/restricted)

## Интеграция с MCP серверами

### Confluence MCP

```typescript
// Поиск страниц
const results = await mcp.confluence.search({
  query: "API documentation",
  spaces_filter: "DEV,TECH"
});

// Получение страницы
const page = await mcp.confluence.getPage({
  page_id: "123456789",
  convert_to_markdown: true
});

// Создание страницы
const created = await mcp.confluence.createPage({
  space_key: "DEV",
  title: "New API Docs",
  content: markdownContent,
  content_format: "markdown",
  parent_id: "parent-page-id"
});

// Обновление страницы
await mcp.confluence.updatePage({
  page_id: "123456789",
  title: "Updated Title",
  content: updatedContent,
  version_comment: "Added examples"
});

// Получение дочерних страниц
const children = await mcp.confluence.getPageChildren({
  parent_id: "123456789",
  include_content: false
});
```

### Notion MCP (если доступен)

```typescript
// Поиск страниц
const results = await mcp.notion.search({
  query: "documentation"
});

// Получение страницы
const page = await mcp.notion.getPage({
  page_id: "abc-def-123"
});

// Создание страницы
const created = await mcp.notion.createPage({
  parent: { database_id: "db-id" },
  properties: {
    "Name": { title: [{ text: { content: "New Doc" } }] }
  }
});
```

### Файловая система (Git)

```bash
# Поиск документов
grep -r "keyword" docs/
find docs/ -name "*.md" -type f

# Создание документа
cat > docs/new-doc.md <<EOF
---
title: New Document
---
# Content
EOF

# Редактирование (через Edit tool)
# Валидация ссылок
find docs/ -name "*.md" -exec grep -H "\[.*\](.*)" {} \;
```

## Примеры использования

### Пример 1: Создание документации с автоопределением платформы

```typescript
// 1. Определить платформу
const platform = await detectDocumentationPlatform();

if (!platform) {
  const userChoice = await askUser({
    question: "Где находится документация?",
    options: [
      "Confluence (MCP сервер)",
      "Markdown файлы в проекте",
      "MkDocs",
      "Notion",
      "Другое"
    ]
  });
}

// 2. Создать документ
if (platform === 'confluence') {
  // Использовать Confluence MCP
  await mcp.confluence.createPage({...});
} else if (platform === 'markdown') {
  // Создать .md файл
  await writeFile('docs/new-doc.md', content);
} else if (platform === 'mkdocs') {
  // Создать файл + обновить mkdocs.yml
}
```

### Пример 2: Поиск и создание перекрестных ссылок

```typescript
const content = `
Our payment service integrates with the authentication system
to process secure transactions using the API gateway.
`;

// Извлечь ключевые фразы
const entities = [
  "payment service",
  "authentication system",
  "API gateway"
];

// Найти связанные документы
for (const entity of entities) {
  const related = await search(entity, { limit: 3 });

  if (related.length > 0) {
    console.log(`💡 Найдены документы по "${entity}":`);
    related.forEach((doc, i) => {
      console.log(`   ${i+1}. ${doc.title} (релевантность: ${doc.relevance})`);
    });

    if (related[0].relevance > 0.8) {
      // Автоматически предложить ссылку
      console.log(`   ✅ Рекомендую добавить ссылку на "${related[0].title}"`);
    }
  }
}
```

### Пример 3: Валидация ссылок в Markdown

```typescript
async function validateMarkdownLinks(docPath: string) {
  const content = await readFile(docPath);
  const links = extractMarkdownLinks(content);

  console.log(`Проверка ссылок в ${docPath}...`);

  for (const link of links) {
    if (link.type === 'internal') {
      // Относительный путь
      const targetPath = resolvePath(docPath, link.href);
      const exists = await fileExists(targetPath);

      if (!exists) {
        console.log(`❌ Битая ссылка: [${link.text}](${link.href})`);

        // Попытаться найти похожий файл
        const similar = await findSimilarFiles(link.href);
        if (similar.length > 0) {
          console.log(`   💡 Возможно имелось в виду:`);
          similar.forEach(s => {
            console.log(`      - ${s.path}`);
          });
        }
      } else {
        console.log(`✅ [${link.text}](${link.href})`);
      }
    }
  }
}
```

### Пример 4: Использование шаблонов

```typescript
// Создание ADR из шаблона
const adrContent = applyTemplate('adr', {
  NUMBER: 5,
  TITLE: "Use PostgreSQL for persistence",
  DATE: "2025-01-15",
  STATUS: "Accepted",
  DECIDERS: "Architecture Team",
  CONTEXT: "We need a reliable database...",
  DECISION: "We will use PostgreSQL...",
  POSITIVE_CONSEQUENCES: "- ACID compliance\n- Rich ecosystem",
  NEGATIVE_CONSEQUENCES: "- Requires more ops effort",
  ALTERNATIVES: "- MongoDB\n- MySQL"
});

// Создать документ
await create({
  title: "ADR-5: Use PostgreSQL for persistence",
  path: "architecture/decisions",
  content: adrContent,
  tags: ["adr", "architecture", "database"]
});
```

## Чек-лист перед публикацией

- [ ] Заголовок соответствует содержанию
- [ ] Присутствует краткое описание (summary)
- [ ] Иерархия заголовков корректна (H1 → H2 → H3)
- [ ] Все ссылки валидны (проверено через validateLinks)
- [ ] Код-блоки имеют указание языка
- [ ] Таблицы форматированы корректно
- [ ] Добавлены релевантные метки/теги
- [ ] Указан автор и дата последнего обновления
- [ ] Связанные документы перелинкованы
- [ ] Нет дублирования (выполнен поиск похожих)

## Обработка ошибок

### Retry-стратегия для API

```typescript
// 4xx — ошибки клиента (не retry)
400: "Invalid parameters"
401: "Authentication failed"
403: "Access denied"
404: "Document not found"
409: "Conflict (concurrent edit)"

// 5xx — ошибки сервера (retry с exponential backoff)
500: "Server error" → retry
502: "Bad gateway" → retry
503: "Service unavailable" → retry
```

## Адаптация к конкретным платформам

### Confluence
- **Создание:** `mcp.confluence.createPage()`
- **Поиск:** `mcp.confluence.search()`
- **Формат:** Markdown или Confluence Storage Format
- **Ссылки:** ID-based (`pageId:123456`)

### Markdown (файловая система)
- **Создание:** Write tool
- **Поиск:** Grep + Glob
- **Формат:** Markdown с YAML frontmatter
- **Ссылки:** Относительные пути (`../docs/api.md`)

### MkDocs
- **Создание:** Write + обновление `mkdocs.yml`
- **Поиск:** Grep по `docs/` + парсинг `mkdocs.yml`
- **Формат:** Markdown
- **Ссылки:** Относительные пути
- **Навигация:** Управление через `nav` в `mkdocs.yml`

### Notion
- **Создание:** Notion API (если MCP доступен)
- **Поиск:** Notion search API
- **Формат:** Notion blocks
- **Ссылки:** Block IDs или URLs

## Лучшие практики

1. **DRY Documentation:** Избегайте дублирования, используйте ссылки
2. **Living Documentation:** Документация рядом с кодом (docs-as-code)
3. **Версионирование:** Документация версионируется вместе с кодом (Git)
4. **Review Process:** Code review для документации
5. **Automation:** Автогенерация API docs из кода (OpenAPI, JSDoc)
6. **Search Optimization:** Четкие заголовки и ключевые слова
7. **Cross-linking:** Активно используйте перекрестные ссылки
8. **Templates:** Стандартизируйте структуру через шаблоны
9. **Validation:** Регулярная валидация ссылок и структуры
10. **Maintenance:** Регулярный аудит устаревшей документации

---

**Принцип работы:** Skill автоматически адаптируется к доступной платформе документирования или запрашивает у пользователя, где находится документация. Все операции унифицированы, но реализация зависит от конкретной системы.

**Совместимость:** Confluence, Notion, GitBook, MkDocs, Docusaurus, ReadTheDocs, Wiki-системы, Markdown в Git.
