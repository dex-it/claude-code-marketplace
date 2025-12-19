---
name: doc-worker
description: Принципы создания и организации продуктовой документации (requirements, ADRs, notes, research). Активируется при работе с документацией, требованиями, заметками, исследованиями. Ключевые слова - документация, document, docs, requirements doc, BRD, PRD, spec, ADR, notes, research findings, meeting notes.
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, AskUserQuestion
---

# Doc Worker — Product Documentation Skill

Создание и управление PM документацией: BRD/PRD, ADR, research findings, meeting notes, идеи.

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
Product Documentation
├── Strategy & Vision
├── Requirements (BRD/PRD)
├── Decisions (ADRs)
├── Research & Discovery
└── Notes & Ideas
```

**Принципы:** Parent-child, breadcrumbs, max 3-4 уровня.

### 3. Перекрестные ссылки

**Обнаружение:** Явные упоминания ("см. BRD: X", "согласно ADR-005"), metadata frontmatter (related: [adr-005]).

**НЕ делать:** Full-text анализ всех документов.

**Примеры связей:** BRD→ADR, Requirements→Research, ADR→ADR, Notes→Actions, Ideas→Requirements.

### 4. Декомпозиция

**Разбивать если:** >500 строк, >5 разделов H2, разные аудитории, независимые обновления.

**Стратегии:** По аудитории (exec/PM/dev), по компонентам, по типу контента, по времени.

**Правило:** Главный документ = hub со ссылками на поддокументы.

### 5. Метаданные

```yaml
---
title: BRD: Payment Integration
type: brd | prd | adr | research | notes | ideas
status: draft | review | approved | active | archived
owner: PM Name
created: 2025-01-15
updated: 2025-01-20
tags: [payments, requirements, high-priority]
related:
  - adr: ADR-005
  - research: User Interviews
---
```

## Шаблоны

### BRD (Business Requirements)

```yaml
---
title: BRD: {NAME}
type: brd
---
```

**Разделы:** Executive Summary, Business Context, Stakeholders, Business Objectives, Functional Requirements, Non-Functional Requirements, Success Criteria, Risks.

### PRD (Product Requirements)

```yaml
---
title: PRD: {NAME}
type: prd
---
```

**Разделы:** Overview, Goals & Objectives, User Personas, Use Cases, Requirements (FR/NFR), Out of Scope, Dependencies, Open Questions.

### ADR (Architecture Decision Record)

```yaml
---
title: ADR-{N}: {TITLE}
type: adr
status: proposed | accepted | deprecated
---
```

**Разделы:** Context, Decision, Consequences (Positive/Negative), Alternatives Considered, References.

### Research Findings

```yaml
---
title: Research: {TOPIC}
type: research
---
```

**Разделы:** Objective, Methodology, Key Findings, User Quotes, Recommendations, Next Steps.

### Meeting Notes

```yaml
---
title: Meeting: {TOPIC}
type: notes
attendees: [...]
---
```

**Разделы:** Agenda, Discussion, Decisions, Action Items, Parking Lot, Next Meeting.

### Ideas & Brainstorming

```yaml
---
title: Ideas: {TOPIC}
type: ideas
---
```

**Разделы:** Context, Ideas (Description/Pros/Cons/Effort/Impact), Priority Ranking, Next Steps.

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
- Priority lists: Must Have (P0), Should Have (P1), Could Have (P2)

## Управление дублированием

```
Создание "{TITLE}":
├─ Поиск похожих (title/tags/path)
├─ Найдены? → [Обновить | Создать дочерний | Объединить | Новый с обоснованием]
└─ Не найдены → Создать + metadata + links
```

**Исключения:** Разные spaces/проекты, версии продукта, аудитории, языки.

## Права и безопасность

1. **Подтверждения:** Массовые изменения (>5), удаление, перемещение
2. **Visibility:** Соблюдать public/private/restricted
3. **Ownership:** Согласование с автором для significant changes

## Чек-лист качества

**Структура:** Title, summary, H1→H2→H3, metadata (type/status/tags/owner)

**Содержание:** Цель ясна (BRD/PRD), success criteria (requirements), scope (BRD/PRD), evidence (research), action items (notes)

**Связи:** Ссылки валидны, related docs, bidirectional links

**Форматирование:** Code blocks с языком, таблицы, callouts

**Governance:** Нет дублей, автор, дата обновления, актуальный status

## Лучшие практики

1. **DRY Documentation** — один источник правды, ссылки вместо дублей
2. **Living Documentation** — обновляется с продуктом
3. **Progressive Elaboration** — Ideas → Research → Requirements → Implementation
4. **Search Optimization** — четкие заголовки и keywords
5. **Cross-linking** — активное использование связей
6. **Templates** — стандартизация структуры
7. **Validation** — регулярная проверка ссылок
8. **Hierarchy** — логическая группировка, max 3-4 уровня
9. **Metadata** — заполнение для поиска и фильтрации
10. **Audience** — писать для целевой аудитории
