---
name: product-discovery
description: Product discovery — ошибки исследования, валидации, интервью. Активируется при discovery, customer interviews, validation, problem-solution fit, market research
---

# Product Discovery — ловушки

## Правила

- Problem first, solution second
- Validate before build: Assumption → Hypothesis → Experiment → Learn
- 5-10 интервью для problem discovery, 5-8 для solution testing
- Jobs-to-be-Done: "When [situation], I want [motivation], so I can [outcome]"

## Красные флаги

| Фраза | Проблема |
|-------|----------|
| "Всем это нужно" | Нет сегментации, нет данных |
| "У нас нет конкурентов" | Не искали или игнорируют substitutes |
| "Просто построим" | Skip validation → build wrong thing |
| "Пользователи привыкнут" | Forcing behaviour change без value |
| Список фичей без проблемы | Solution-first thinking |

## Ошибки интервью

```
Плохо: "Вам бы понравилась функция X?"
// Confirmation bias — люди говорят "да" чтобы не обидеть
Хорошо: "Расскажите о последнем разе, когда вы [задача]. Что было сложнее всего?"

Плохо: "Вы бы заплатили $10/мес за это?"
// Гипотетическое намерение ≠ реальное поведение
Хорошо: "Сколько вы сейчас тратите на решение этой проблемы?"

Плохо: Интервьюировать друзей/коллег
// Mom test: они скажут то, что вы хотите услышать
Хорошо: Интервьюировать незнакомых из целевого сегмента

Плохо: Закрытые вопросы (да/нет)
Хорошо: Открытые: "Расскажите...", "Как вы...", "Что было..."
```

## Валидация — лестница уверенности

| Уровень | Метод | Уверенность |
|---------|-------|-------------|
| 1 | Интервью (хотят ли?) | Низкая |
| 2 | Landing page / Fake door (нажмут ли?) | Средняя |
| 3 | Concierge MVP (используют ли вручную?) | Высокая |
| 4 | Beta + оплата (заплатят ли?) | Очень высокая |

**Ловушка:** Прыгнуть с уровня 1 сразу к full build. Каждый уровень дешевле предыдущего — не пропускай.

## Problem Statement — формула

```
Плохо: "Нужна CRM для менеджеров"
// Нет проблемы, нет impact, нет data

Хорошо: "[Junior devs] тратят [50% времени] на [навигацию по кодовой базе],
         что [снижает velocity команды в 2 раза]"
// Кто + сколько + проблема + quantified impact
```

## Чек-лист

- [ ] Проблема validated (10+ интервью, не гипотеза)
- [ ] Открытые вопросы, не наводящие
- [ ] Интервьюируемые — из целевого сегмента (не друзья)
- [ ] Problem statement с quantified impact
- [ ] Hypothesis format: "We believe [X] will [Y] because [Z]"
- [ ] Валидация поэтапная (interview → fake door → MVP → beta)
- [ ] Competitors analyzed (включая substitutes)
- [ ] Решение НЕ начато до validation
