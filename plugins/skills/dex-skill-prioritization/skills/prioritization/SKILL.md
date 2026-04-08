---
name: prioritization
description: Приоритизация — ловушки RICE, ICE, MoSCoW, scoring. Активируется при приоритизация, prioritize, RICE score, MoSCoW, backlog prioritization, feature ranking, ICE, Kano model, Value/Effort matrix, reach, confidence, effort, P0, техдолг, quarterly planning
---

# Prioritization — ловушки и anti-patterns

## RICE

### Reach в процентах вместо абсолютных чисел
Плохо: `Reach: "Много пользователей" (70%)` — проценты не сравнимы между features
Правильно: `Reach: 1000 users/quarter` — абсолютное число из analytics
Почему: 70% от чего? Без абсолютного числа невозможно сравнить reach двух features из разных частей продукта

### Effort без единиц измерения
Плохо: `Effort: 2` — дни? недели? person-months? Каждый понимает по-своему
Правильно: `Effort: 1.5 person-months (includes design + dev + QA + docs)`
Почему: без единицы RICE score несравним между командами. person-months включают все фазы, не только dev

### Confidence 100% без данных
Плохо: `Confidence: 100%` ("я уверен") — уверенность без валидации
Правильно: `Confidence: 80%` с обоснованием: "Reach validated по analytics, Impact based on NPS surveys"
Почему: 100% confidence = самообман. Без A/B теста impact всегда предположение. Завышенный confidence искажает приоритеты

### Fake precision в scores
Плохо: RICE score 3247 vs 3251 — какой приоритетнее? Споры о decimals
Правильно: группировать по тирам (High/Medium/Low) или range (3000-3500 = Tier 1)
Почему: входные данные неточны (Reach = оценка, Impact = предположение). Разница в 4 единицы = шум, не сигнал

## MoSCoW

### Все Must Have
Плохо: Must Have: Auth, Payment, Search, Notifications, Reports, Dark Mode, Export, Import. Should Have: (пусто)
Правильно: Must Have max 30%: Auth, Payment. Should Have 30%: Search, Notifications. Could Have 20%. Won't Have 20%
Почему: если все Must Have — нет приоритизации. Scope creep, дедлайн сорван, качество падает

### MoSCoW для data-driven решений
Плохо: MoSCoW когда есть analytics, surveys, A/B test результаты
Правильно: RICE для data-driven решений, MoSCoW для MVP scope definition без данных
Почему: MoSCoW = субъективная категоризация. При наличии данных RICE дает более обоснованные приоритеты

## Организация процесса

### HIPPO — решение по авторитету
Плохо: "Директор сказал — делаем первым" без обоснования
Правильно: покажи RICE scores + обоснование. Директор может overrule, но с explicit trade-off
Почему: без фреймворка решения непрозрачны. Команда теряет мотивацию, приоритеты = политика, не продукт

### Все задачи P0
Плохо: 50% backlog помечен P0/Critical — ничего не приоритизировано
Правильно: квота: max 15% = P0. Остальное P1/P2/P3 с четкими критериями
Почему: если все critical — ничего не critical. Команда не знает за что браться первым, параллелит слишком много

### Set & forget — приоритеты устаревают
Плохо: RICE scores посчитаны в январе, используются в сентябре без ревью
Правильно: quarterly re-scoring с обновленными данными (analytics, market changes)
Почему: Reach меняется (рост пользователей), Impact меняется (конкуренты запустили аналог), Effort меняется (tech debt)

### 100% features, 0% tech debt
Плохо: весь бэклог — только новый функционал, tech debt откладывается "на потом"
Правильно: 70% features / 20% tech debt / 10% experiments — фиксированное соотношение
Почему: без tech debt инвестиций каждая feature стоит дороже. Без экспериментов — нет инноваций

### Analysis paralysis — неделя на scoring
Плохо: неделя на детальный RICE scoring 50 features с точностью до единицы
Правильно: ICE для быстрых решений (5 минут на feature), RICE только для крупных инициатив
Почему: цена анализа не должна превышать ценность решения. ICE = быстрая прикидка, RICE = детальный анализ

## Чек-лист

- Framework выбран осознанно (RICE/ICE/MoSCoW)
- Reach — абсолютные числа, не проценты
- Effort включает design + dev + QA
- Confidence обоснована (данные, не "уверен")
- Max 15% items = P0 (не "все critical")
- Assumptions задокументированы
- Re-scoring каждый квартал
- Balance: 70% features / 20% debt / 10% experiments
