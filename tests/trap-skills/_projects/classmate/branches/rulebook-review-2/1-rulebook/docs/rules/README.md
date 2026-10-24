---
type: rulebook
status: review
owner: olga
updated: 2026-10-12
quality-checks: входных записей нет
---

# Свод правил проекта Classmate

Что принято в этом репозитории, выведенное из истории ревью. Схема таксона - `internal`, версия 2.
Реестр источников - `sources.md`, наблюдения - `notes.md`.

| ID | Формулировка | Таксон | scope | Статус | Принуждение |
|---|---|---|---|---|---|
| RUL-0001 | Называй тест `<функция> - <условие> - <ожидаемый результат>` | `internal:naming@2` | `test/**` | proposed | manual |
| RUL-0002 | Не ретраи запросы к PayFlow в коде | `internal:integration@2` | `src/**` | proposed | manual |
| RUL-0003 | Любой MR согласует @guest-reviewer | `internal:review-process@2` | `**` | proposed | manual |
