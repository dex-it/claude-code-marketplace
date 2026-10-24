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
| RUL-0001 | Называй ветку `<тип>/CM-<номер>-<слаг>` | `internal:naming@2` | `**` | proposed | manual |
| RUL-0002 | Называй тест `<функция> - <условие> - <ожидаемый результат>` | `internal:naming@2` | `test/**` | proposed | manual |
| RUL-0004 | Не пиши в логи персональные данные ученика | `internal:security@2` | `src/**` | proposed | manual |
| RUL-0005 | Считай деньги в целых копейках | `internal:integration@2` | `src/**` | proposed | manual |
| RUL-0006 | Делай отступ 2 пробела | `internal:layout@2` | `**/*.js` | proposed | manual |
| RUL-0007 | Сравнивай строго, через `===` | `internal:error-handling@2` | `src/**/*.js` | proposed | manual |
| RUL-0008 | Называй тест по трём частям: что вызываем, при каком условии, что ожидаем | `internal:naming@2` | `test/**` | proposed | manual |
| RUL-0009 | Из доменной функции возвращай отказ результатом `{ ok: false, code }` | `internal:error-handling@2` | `src/**` | proposed | manual |
| RUL-0010 | На некорректный вход доменной функции бросай `Error` | `internal:error-handling@2` | `src/**` | proposed | manual |
| RUL-0011 | Тестируй только экспортируемые функции модуля | `internal:testing@2` | `test/**` | accepted | manual |
| RUL-0013 | Принимай `signal` в обработчиках и прокидывай его дальше | `internal:concurrency@2` | `src/**` | proposed | manual |
| RUL-0014 | Не ретраи запросы к PayFlow в коде | `internal:integration` | `src/**` | accepted | manual |
| RUL-0015 | Храни время урока в зоне репетитора | `internal:signature-convention@2` | `src/booking/**` | proposed | manual |
| RUL-0016 | Храни и передавай даты в UTC ISO-строкой | `internal:signature-convention@2` | `src/**` | proposed | manual |
| RUL-0017 | MR, который трогает `src/billing/`, согласует Сергей | `internal:review-process@2` | `src/billing/**` | proposed | manual |
| RUL-0018 | Держи ключ SMTP в переменной окружения | `internal:security@2` | `src/smtp/**` | proposed | manual |
| RUL-0019 | Используй все параметры функции | `internal:signature-convention@2` | `src/**` | proposed | manual |
