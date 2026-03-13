---
name: epic-planning
description: Epic planning — ошибки формулировки, sizing, scope. Активируется при epic, roadmap, initiative, planning, business value, success metrics
---

# Epic Planning — ловушки

## Правила

- Epic = 2-12 weeks, 5-15 stories. Меньше → story, больше → initiative
- Outcome over output: "Increase activation by 20%", не "Build 5 features"
- Success metrics с baseline + target + timeline
- Out of Scope обязателен (manage expectations)
- Anti-metrics: что НЕ должно ухудшиться

## Частые ошибки

| Ошибка | Пример | Исправление |
|--------|--------|-------------|
| Нет value | "Рефакторинг бэкенда" | "Сократить время ответа API с 5с до 1с" |
| Нет метрик | "Улучшить UX" | "Снизить bounce rate с 45% до 20%" |
| Нет Out of Scope | Scope creep через месяц | Явно: "Multi-language — NOT in scope" |
| Слишком большой | >3 месяцев, размытый scope | Split на 2-3 focused epics |
| Слишком маленький | 1 story, 1 неделя | Это story, не epic |
| Output-focused | "Выпустить 5 фичей" | "Увеличить retention Day 7 на 15%" |
| Нет anti-metrics | Оптимизировали скорость, упал uptime | "Uptime не должен упасть ниже 99.9%" |
| Fake precision | "Estimated: 47.3 SP" | T-shirt sizing: S/M/L/XL |

## Anti-metrics — что часто забывают

```
Epic: Ускорение загрузки страниц

Success metric: Page load <2 sec (p95)
Anti-metrics (НЕ должны ухудшиться):
- Error rate: не выше 0.1%
- SEO score: не ниже текущего
- Uptime: не ниже 99.9%
// Без anti-metrics: ускорили страницу, но сломали SEO
```

## Sizing

```
S  (2-4 weeks):  5-8 stories, well understood
M  (1-2 months): 8-12 stories, some unknowns
L  (2-3 months): 12-15 stories, moderate risk
XL (3+ months):  SPLIT! Слишком большой для одного epic
```

## Progressive Elaboration

```
3 месяца до старта: High-level epic, rough estimate, general scope
1 месяц до старта:  SA создаёт stories, команда оценивает
Sprint planning:     Детальные AC, tech design, DoR проверен

НЕ детализируй то, что будет через полгода — оно изменится
```

## Чек-лист

- [ ] Формулировка через outcome, не output
- [ ] Success metrics: baseline → target → timeline
- [ ] Anti-metrics: что не должно ухудшиться
- [ ] Out of Scope явно указан
- [ ] Size: S/M/L (не XL — split!)
- [ ] Можно разбить на 5-15 stories
- [ ] Dependencies и risks идентифицированы
