---
name: doc-worker
description: Принципы создания и организации технической документации (user stories, technical specs, API specs, process docs). Активируется при работе с документацией, спецификациями, user stories. Ключевые слова - документация, document, docs, user story, technical spec, API spec, процесс, BPMN, acceptance criteria.
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, AskUserQuestion
---

# Doc Worker — Technical Documentation Skill

Создание и управление SA документацией: user stories, technical specs, API specs, process documentation, acceptance criteria.

## Поддерживаемые платформы

Wiki (Confluence, MediaWiki), Cloud (Notion, GitBook), Static (MkDocs, Docusaurus), Markdown в Git.

Skill автоматически адаптируется к доступной системе.

## Основные принципы

### 1. Search-First

**Перед созданием документа:**
1. Поиск по title (exact + fuzzy)
2. Поиск по tags/metadata
3. Проверка иерархии (parent documents)
4. Использование search API платформы (если доступен)

**Найдены похожие (>70% similarity)?**
→ Обновить существующий / создать дочерний / объединить / не уверен - спроси пользователя

**Важно:** НЕ читать содержимое всех документов. Полагаться на metadata (title, tags, path).

### 2. Иерархия

```
Technical Documentation
├── User Stories (from Epics)
├── Technical Specifications
├── API Documentation
├── Process Documentation (BPMN)
└── Test Cases
```

**Принципы:** Parent-child (Epic→Stories), breadcrumbs, max 3-4 уровня.

### 3. Перекрестные ссылки

**Обнаружение:** Явные упоминания ("см. Story US-123", "согласно Tech Spec: X"), metadata frontmatter (related: [epic-001, api-spec]).

**НЕ делать:** Full-text анализ всех документов.

**Примеры связей:** Story→Epic, Story→TechSpec, TechSpec→API, Process→Stories, TestCase→Story.

### 4. Декомпозиция

**Разбивать если:** >500 строк, >5 разделов H2, разные аудитории, независимые обновления.

**Стратегии:** По компонентам (frontend/backend/db), по функциям, по endpoints (API), по процессам.

**Правило:** Главный документ = hub со ссылками на поддокументы.

### 5. Метаданные

```yaml
---
title: "US-123: User Login"
type: user-story | tech-spec | api-spec | process | test-case
status: draft | review | ready | in-progress | done
epic: Epic: Authentication
priority: must-have | should-have | could-have
story-points: 5
tags: [auth, frontend, api]
related:
  - epic: Authentication
  - spec: Auth Technical Spec
  - api: POST /api/auth/login
---
```

## Шаблоны

### User Story

```yaml
---
title: "US-{N}: {NAME}"
type: user-story
epic: Epic Name
priority: must-have | should-have | could-have
story-points: 1-13
---
```

**Разделы:** User Story (As a/I want/So that), Acceptance Criteria (Given/When/Then), Technical Notes, Dependencies, Definition of Done.

### Technical Specification

```yaml
---
title: "Tech Spec: {NAME}"
type: tech-spec
---
```

**Разделы:** Overview, Architecture, Components, Data Model, API Contracts, Security, Error Handling, Performance, Testing Strategy.

### API Specification

```yaml
---
title: "API: {METHOD} {ENDPOINT}"
type: api-spec
---
```

**Разделы:** Endpoint, Method, Authentication, Request (Headers/Body/Parameters), Response (Success/Error), Status Codes, Examples, Rate Limiting.

### Process Documentation (BPMN)

```yaml
---
title: "Process: {NAME}"
type: process
---
```

**Разделы:** Overview, Actors, Flow (Steps/Decisions/Gateways), Business Rules, Exception Handling, BPMN Diagram.

### Test Case

```yaml
---
title: "TC-{N}: {NAME}"
type: test-case
user-story: US-123
---
```

**Разделы:** Objective, Preconditions, Steps, Expected Results, Actual Results, Status (Pass/Fail/Blocked).

## Стандарты форматирования

**Структура документа:**
```yaml
---
metadata (frontmatter)
---

# Title (H1 - один)

**Summary:** One sentence
**Owner:** Name

## Main Sections (H2)
### Subsections (H3, max H4)

## Related Documents
## References
## Changelog
```

**Элементы:**
- Inline code: `variable`
- Code blocks: ```python ... ```
- Таблицы: markdown tables
- Callouts: > **Note/Warning/Tip**
- INVEST criteria: Independent, Negotiable, Valuable, Estimable, Small, Testable
- Given-When-Then: Acceptance criteria format

## User Story Best Practices

### INVEST Criteria

**Independent:** Minimal dependencies, can develop in any order
**Negotiable:** Details emerge through conversation
**Valuable:** Clear benefit to user or business
**Estimable:** Team can estimate complexity
**Small:** Fits in one sprint (1-5 days)
**Testable:** Clear acceptance criteria

### Story Sizing

```
1 point: Few hours (trivial)
2 points: ~1 day (small feature)
3 points: 1-2 days (medium)
5 points: 2-3 days (large)
8 points: 3-5 days (very large, consider splitting)
13+ points: Too large, must break down
```

### Acceptance Criteria Format

```
Given [context/precondition]
When [action/event]
Then [expected outcome]

Example:
Given user is on login page
When user enters valid credentials and clicks "Login"
Then user is redirected to dashboard
And user sees welcome message with their name
```

## API Documentation Best Practices

### OpenAPI/Swagger Structure

```yaml
openapi: 3.0.0
info:
  title: API Name
  version: 1.0.0
paths:
  /resource:
    get:
      summary: Brief description
      parameters: [...]
      responses:
        200:
          description: Success
          content: [...]
```

### Request/Response Examples

Always include:
- Minimal valid request
- Full successful response
- Common error responses (400, 401, 404, 500)
- Edge cases

## Управление дублированием

```
Создание "{TITLE}":
├─ Поиск похожих (title/tags/path)
├─ Найдены? → [Обновить | Создать дочерний | Объединить | Новый с обоснованием]
└─ Не найдены → Создать + metadata + links
```

**Исключения:** Разные компоненты, версии API, environments (dev/staging/prod).

## Права и безопасность

1. **Подтверждения:** Массовые изменения (>5), удаление, перемещение
2. **Visibility:** Соблюдать public/private/restricted
3. **Ownership:** Согласование с автором для significant changes

## Чек-лист качества

**User Story:**
- [ ] Follows INVEST criteria
- [ ] Has Given-When-Then acceptance criteria
- [ ] Story points estimated
- [ ] Linked to Epic
- [ ] Definition of Done clear

**Technical Spec:**
- [ ] Architecture diagram included
- [ ] Data model defined
- [ ] API contracts specified
- [ ] Error handling documented
- [ ] Security considerations addressed

**API Spec:**
- [ ] All endpoints documented
- [ ] Request/response examples provided
- [ ] Status codes defined
- [ ] Authentication described
- [ ] Rate limiting specified

**Process:**
- [ ] BPMN diagram included (or clear flow)
- [ ] All actors identified
- [ ] Decision points documented
- [ ] Exception paths covered

## Лучшие практики

1. **DRY Documentation** — один источник правды, ссылки вместо дублей
2. **Living Documentation** — обновляется с продуктом
3. **Progressive Elaboration** — Epic → Story → Tasks → Implementation
4. **Search Optimization** — четкие заголовки и keywords
5. **Cross-linking** — активное использование связей
6. **Templates** — стандартизация структуры
7. **Validation** — регулярная проверка ссылок
8. **Hierarchy** — логическая группировка, max 3-4 уровня
9. **Metadata** — заполнение для поиска и фильтрации
10. **Audience** — писать для developers/QA, не для executives
