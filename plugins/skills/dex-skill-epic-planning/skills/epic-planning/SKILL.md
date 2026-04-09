---
name: epic-planning
description: Epic planning — ловушки sizing, scope. Активируется при epic, roadmap, initiative, planning, business value, success metrics, anti-metrics, out of scope, outcome, T-shirt sizing, scope creep
---

# Epic Planning — ловушки

## Формулировка

### Output вместо Outcome
Плохо: "Выпустить 5 фичей" или "Рефакторинг бэкенда" — что делаем, а не зачем
Правильно: "Увеличить retention Day 7 на 15%" или "Сократить время ответа API с 5с до 1с"
Почему: output не гарантирует value. 5 фичей могут не решить проблему пользователя

### Нет Business Value
Плохо: "Рефакторинг auth-модуля" — технический scope без пользовательской ценности
Правильно: "Пользователь может войти за <3 сек" — measurable outcome
Почему: без value стейкхолдеры не понимают приоритет, epic откладывается бесконечно

### Размытая формулировка
Плохо: "Улучшить UX" — нельзя измерить, нельзя проверить готовность
Правильно: "Снизить bounce rate с 45% до 20% на странице регистрации"
Почему: без конкретики epic никогда не "закончен", scope creep гарантирован

## Метрики

### Нет Success Metrics
Плохо: epic без измеримых критериев успеха
Правильно: metrics с тремя компонентами: `baseline` -> `target` -> `timeline`
Почему: без baseline непонятно стало ли лучше, без target нет цели, без timeline нет deadline

### Нет Anti-Metrics
Плохо: "Ускорить загрузку страниц" без ограничений на side effects
Правильно: "Error rate не выше 0.1%, SEO score не ниже текущего, Uptime >= 99.9%"
Почему: оптимизация скорости может сломать SEO или стабильность. Anti-metrics ставят guard rails

### Fake Precision в оценке
Плохо: "Estimated: 47.3 SP" — ложная точность
Правильно: T-shirt sizing: S (2-4 нед), M (1-2 мес), L (2-3 мес), XL -> split
Почему: на уровне epic точная оценка невозможна, fake precision создаёт ложную уверенность

## Scope

### Нет Out of Scope
Плохо: epic описывает что входит, но не что НЕ входит
Правильно: явный раздел "Out of Scope": "Multi-language - NOT in scope"
Почему: scope creep через месяц, стейкхолдеры добавляют фичи "а мы думали это тоже"

### Слишком большой epic
Плохо: >3 месяцев, размытый scope, 20+ stories
Правильно: 2-12 weeks, 5-15 stories. Если XL -> split на 2-3 focused epics
Почему: большой epic = непредсказуемый deadline, демотивация команды, невозможность pivot

### Слишком маленький epic
Плохо: 1 story, 1 неделя работы
Правильно: это story, не epic. Epic = 5-15 stories minimum
Почему: overhead планирования epic не оправдан для одной задачи

## Elaboration

### Детализация всего заранее
Плохо: детальные AC для stories, запланированных через 6 месяцев
Правильно: progressive elaboration: 3 мес до старта = rough scope, 1 мес = stories, sprint = AC
Почему: требования изменятся, детализация устареет, потрачено время впустую

### Dependencies не идентифицированы
Плохо: epic запланирован без учёта зависимостей от других команд/систем
Правильно: Dependencies и risks идентифицированы на этапе планирования
Почему: blocked epic = потерянный спринт, команда переключается на другое и теряет контекст

## Чек-лист

- Формулировка через outcome, не output
- Success metrics: baseline -> target -> timeline
- Anti-metrics: что не должно ухудшиться
- Out of Scope явно указан
- Size: S/M/L (не XL, split!)
- 5-15 stories в epic
- Dependencies и risks идентифицированы
