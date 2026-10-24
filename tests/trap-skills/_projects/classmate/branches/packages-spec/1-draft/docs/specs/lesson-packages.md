---
type: tech-spec
status: draft
owner: Иван
updated: 2026-10-06
---

# Пакеты уроков - tech spec

## Что делаем

Ученик покупает пакет из N уроков у конкретного репетитора со скидкой и списывает уроки из пакета при брони.

## Модель данных

Таблица `packages`: `id`, `student_id`, `tutor_id`, `lessons_total`, `lessons_left`, `price_cents`, `expires_at`.

## TODO
- оплата
- что при отмене
- выкат
