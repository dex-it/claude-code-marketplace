---
name: doc-standards
description: Документация — ловушки структуры, дублирования, устаревания. Активируется при documentation, document, docs, spec, BRD, PRD, ADR, tech spec, single source of truth, out of scope, metadata, cross-reference, rollback plan, документация, техническая спецификация
---

# Documentation — ловушки

## Правила

- Search before create — не дублируй существующие документы
- Single source of truth — ссылки вместо копий
- Max 3-4 уровня вложенности
- >500 строк или >5 H2 секций → split на sub-документы
- Metadata обязательна (type, status, owner, updated)

## Анти-паттерны

| Анти-паттерн | Проблема | Решение |
|--------------|----------|---------|
| Копипаста | Одна и та же таблица в 3 документах | Один источник + ссылки |
| "Живой документ" без даты | Непонятно, актуально ли | updated: дата в metadata |
| Нет owner | Документ устаревает, никто не обновляет | Owner в metadata |
| Монолит на 2000 строк | Невозможно найти нужное | Split по аудитории/компоненту |
| Нет Out of Scope | Scope creep, ожидания не совпадают | Явный Out of Scope раздел |
| ADR без Alternatives | "Выбрали PostgreSQL" — почему не MongoDB? | Alternatives Considered обязательно |
| Status: Draft навсегда | Документ никогда не approved | Lifecycle: draft→review→approved→archived |

## Часто пропускают

### В BRD/PRD
- **Non-Functional Requirements** — производительность, безопасность, compliance
- **Anti-Metrics** — что НЕ должно ухудшиться (latency, error rate)
- **Out of Scope** — явно что НЕ входит

### В ADR
- **Alternatives Considered** — без них решение выглядит необоснованным
- **Negative Consequences** — только плюсы = неполная картина
- **Supersedes** — ссылка на предыдущий ADR если заменяет

### В Tech Spec
- **Rollout Plan** — как деплоить, rollback strategy
- **Error Handling** — что происходит при сбое
- **Migration** — как мигрировать существующие данные

## Cross-reference правила

```
BRD → ADR (решения, поддерживающие требования)
ADR → ADR (supersedes)
Epic → Stories (parent-child)
Story → Tech Spec (детали реализации)
Tech Spec → API Spec (контракты)
Test Case → Story (что тестируем)
```

## Чек-лист

- [ ] Поискал существующий документ перед созданием нового
- [ ] Metadata заполнена (type, status, owner, updated)
- [ ] Owner назначен
- [ ] Out of Scope явно указан
- [ ] Нет дублирования — ссылки вместо копий
- [ ] ADR содержит Alternatives + Negative Consequences
- [ ] Документ <500 строк (иначе split)
- [ ] Cross-references актуальны
