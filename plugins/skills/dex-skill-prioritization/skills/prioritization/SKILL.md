---
name: prioritization
description: Приоритизация — ошибки RICE, ICE, MoSCoW. Активируется при приоритизация, prioritize, RICE score, MoSCoW, backlog prioritization, feature ranking
allowed-tools: Read, Grep, Glob
---

# Prioritization — ловушки

## Правила

- RICE для data-driven решений, ICE для быстрых
- Reach = реальные числа (users/quarter), НЕ проценты
- Effort в person-months, включает design + dev + QA
- Scores — тiers, не точные числа (3247 ≈ 3251)
- Re-evaluate quarterly

## Частые ошибки

| Ошибка | Проблема | Решение |
|--------|----------|---------|
| Всё P0 | Нет приоритизации | Квота: max 15% = P0 |
| HIPPO | "Директор сказал" | Покажи RICE scores + обоснование |
| Только value | Игнорируют effort | RICE делит на Effort |
| Fake precision | RICE 3247 vs 3251 | Группируй по тирам |
| Set & forget | Приоритеты устаревают | Quarterly re-scoring |
| Analysis paralysis | Неделя на scoring | ICE для быстрых решений |
| 100% features | Нет техдолга и экспериментов | 70% features / 20% debt / 10% experiments |

## Выбор framework

| Ситуация | Framework | НЕ используй |
|----------|-----------|--------------|
| Есть данные (analytics, surveys) | RICE | ICE (потеряешь точность) |
| Быстрая оценка, нет данных | ICE | RICE (будет гадание) |
| MVP scope definition | MoSCoW | RICE (не нужны числа) |
| Визуальный brainstorm | Value/Effort matrix | RICE (слишком формально) |
| Понимание user satisfaction | Kano model | RICE (другая ось оценки) |

## RICE — типичные ошибки

```
Плохо:
  Reach: "Много пользователей" (70%)
  // Проценты не сравнимы между features

Хорошо:
  Reach: 1000 users/quarter
  // Абсолютное число, сравнимо

Плохо:
  Effort: 2 (что это? дни? недели? человеко-месяцы?)

Хорошо:
  Effort: 1.5 person-months (includes design + dev + QA + docs)

Плохо:
  Confidence: 100% ("я уверен")
  // Уверенность без данных — самообман

Хорошо:
  Confidence: 80%
  Обоснование: "Reach validated по analytics,
                Impact based on NPS surveys (не A/B tested)"
```

## MoSCoW — ловушка "всё Must Have"

```
Плохо:
  Must Have: Auth, Payment, Search, Notifications,
             Reports, Dark Mode, Export, Import
  Should Have: (пусто)
  // Если всё must have — ничего не must have

Хорошо:
  Must Have (max 30%):  Auth, Payment (core value, legal)
  Should Have (30%):     Search, Notifications (high value, workarounds exist)
  Could Have (20%):      Reports, Export (nice to have)
  Won't Have (20%):      Dark Mode, Import (future release)
```

## Чек-лист

- [ ] Framework выбран осознанно (RICE/ICE/MoSCoW)
- [ ] Reach — абсолютные числа, не проценты
- [ ] Effort включает design + dev + QA
- [ ] Confidence обоснована (данные, не "уверен")
- [ ] Max 15% items = P0 (не "всё critical")
- [ ] Assumptions задокументированы
- [ ] Re-scoring каждый квартал
- [ ] Balance: 70% features / 20% debt / 10% experiments
