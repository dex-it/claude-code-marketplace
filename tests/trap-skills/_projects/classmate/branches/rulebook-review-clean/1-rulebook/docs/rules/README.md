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
| RUL-0001 | Называй тест `<функция> - <условие> - <ожидаемый результат>`, по-русски | `internal:naming@2` | `test/**` | proposed | manual |
| RUL-0002 | Не ретраи запросы к PayFlow в коде: повторы делает шлюз провайдера | `internal:integration@2` | `src/**` | proposed | manual |
| RUL-0003 | Считай деньги в целых копейках: суммы - целые поля `...Cents`, деление - через `Math.floor`; float для денежных сумм не используй | `internal:signature-convention@2` | `src/**` | proposed | manual |
| RUL-0004 | Тестируй только экспортируемые функции модуля; внутренние хелперы отдельно не тестируй | `internal:testing@2` | `test/**` | proposed | manual |
| RUL-0005 | Храни и передавай даты в UTC ISO-строкой; локальное время - только при выводе пользователю | `internal:signature-convention@2` | `src/**` | proposed | manual |
| RUL-0006 | Покрывай тестом точное значение каждой границы срока в правилах возврата и отмены | `internal:testing@2` | `src/billing/**`, `test/**` | proposed | manual |
