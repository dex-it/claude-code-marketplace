# План: покрытие трека «Разработка» autonomous-task (.NET + TS/JS)

## Цель
Свести набор субагентов/skills под трек «Разработка» автономного агента так,
чтобы каждый слот трека имел профильного исполнителя, БЕЗ дублирования процесса.
Скилл подбирает исполнителя под стек+тип в рантайме.

## Архитектурный принцип (выведен в обсуждении, зафиксирован)
**Общий агент на роль + skills под стек; специальный агент — ТОЛЬКО там, где
стек-специфика живёт В ТЕЛЕ АРТЕФАКТА, а не в условной загрузке skills.**

Уточнённый критерий (после сравнения пар architect и debugger):
- **.NET в теле артефакта** (alternatives в терминах библиотек, идиомы языка,
  конкретика диагностики) → специальный ОПРАВДАН: coder, tester, performance,
  **architect** (Modular monolith→MediatR, Microservices→MassTransit, EF Fluent API).
- **.NET в условной загрузке skills** (`если .NET → грузи X`), а процесс/выход
  стек-нейтрален → общий ДОСТАТОЧЕН, специальный = дубль: reviewer, **debugger**,
  security.

Проверка: architect-dotnet НАПОЛНЯЕТ фазы .NET-содержанием (+ Sync note о намеренной
идентичности структуры) → не дубль. debugger КОПИРУЕТ bug-hunter дословно, отличие
лишь обёртка `если .NET` вокруг того же skill-блока → дубль.

## Матрица трека «Разработка» (охват: .NET + TS/JS; Python вне скоупа)
| # | Слот | Исполнитель | .NET | TS/JS |
|---|------|-------------|------|-------|
| 1 | Контекст | researcher (общий) | general-purpose/Explore | ✅ |
| 2 | План/спека | designer + skill | dex-architect-dotnet | dex-architect |
| 3 | TDD-тесты | tester (СПЕЦ) | dex-dotnet-tester | dex-ts-tester ✅ создан |
| 4 | Код | coder (СПЕЦ) | dex-dotnet-coder | dex-ts-fullstack-coder |
| 5+6+7 | Прогон + ревью кода + арх-ревью | **self-reviewer** (общий) | ✅ | ✅ |
| 8 | Security (отд. проход) | security (общий, threat-model) | dex-security-reviewer | ✅ |
| 9 | Perf (по нужде) | performance (СПЕЦ) | dex-dotnet-performance | — вне скоупа |
| 10 | Debugging (красный прогон) | debugger | dex-dotnet-debugger | dex-debugger (общий) |
| 11 | Сдача | сам (git) | — | — |

**Ключевое открытие:** слоты 5+6+7 (прогон + ревью своего кода + арх) закрывает
ОДИН `dex-self-reviewer` (7 фокусов: security/arch/lang/business/regressions/
loose-ends/local-verification, реальный прогон build/test, фальсификация,
языко-агностичный). Это не дыра — готовый под трек агент.

## Решения (зафиксированы в обсуждении)
1. **dex-ts-tester + dex-skill-ts-vitest-jest** — СОЗДАНЫ, оправданы (tester
   идиоматичен по стеку). Остаются.
2. **dex-debugger (общий)** — ОСТАЁТСЯ как единственный debugger. Покрывает .NET
   через `если .NET` (те же 3 skill) + TS + кросс-стек. bug-hunter удаляется.
3. **dex-dotnet-debugger (bug-hunter)** — УДАЛЯЕМ. Дубль общего debugger: процесс/
   scan/severity/output скопированы, отличие — обёртка `если .NET`. На .NET оба
   идентичны. Радиус: 2 bundle + пример Two-Pass в доках. Пользователь: «примеры
   перепишем» → эталон не блокер.
4. **code-reviewer (.NET, dex-dotnet-reviewer)** — УДАЛЯЕМ. Роль поглощена
   self-reviewer (свой код) + mr-reviewer (чужой MR, .NET через условные skills).
   mr-reviewer строго зрелее: фальсификация, параллельные фокусы, публикация.
   Радиус: 2 bundle + пример Reviewer в доках. «Примеры перепишем» → эталон не блокер.
5. **dex-security-reviewer** — ОСТАВЛЯЕМ, ПЕРЕРАБАТЫВАЕМ (дизайн СОГЛАСОВАН).
   Рамка: специальный агент ГЛУБОКОГО анализа безопасности. self-reviewer =
   ПОВЕРХНОСТНОЕ ревью по скиллам (паттерн-чек в общем прогоне). Не дубль — разные
   уровни глубины (как debugger ↔ dotnet-runtime-diagnostician). owasp-skill — инструмент
   обоих, но self: «сверь по списку», security-reviewer: «модель угроз, owasp =
   справочник векторов для цепочек».

   4 фазы:
   - Phase 1 Threat Model & Attack Surface (first-class): акторы (anon/user/admin/
     service), trust boundaries, entry points, активы (данные/секреты/деньги).
     Главный артефакт, не подготовка.
   - Phase 2 Attack-Path Analysis: для каждой границы — какие OWASP-векторы атакуют.
   - Phase 3 Deep Category Scan: условная загрузка (расширенный набор, ниже).
   - Phase 4 Exploit-Chain & Scoring: цепочки (вход X → Y → актив Z), severity по
     эксплуатируемости ЦЕПОЧКИ, не отдельной находки.

   Условная загрузка skills (Phase 3, всё реально есть в репо):
   - Всегда → owasp-security
   - Если .NET → dotnet-api-development, dotnet-ef-core; при логах → dotnet-logging
   - Если TS/JS → nodejs-api
   - Если auth/лимиты/multi-tenant → nfr
   - Если идемпотентность/rate-limit → distributed-resilience
   - Если межсервис → microservices (SSRF между сервисами)
   (+2 условных против текущей версии: distributed-resilience, microservices; +1
   dotnet-logging как security-вектор.)

   Boundaries: self-reviewer = поверхностный паттерн-чек в саморевью; этот агент =
   глубокий threat-model для security-критичных треков / когда поверхностный фокус
   зацепил и нужно копать. Только security, код не правит, выход = findings-цепочки.

## Пары «общий / .NET» — итоговый вердикт по каждой
| Роль | .NET в теле? | Вердикт |
|------|--------------|---------|
| architect | да (библиотеки экосистемы) | ОБА остаются ✅ |
| coder | да (идиомы C#) | специальный нужен ✅ |
| tester | да (Moq/xUnit) | специальный нужен ✅ |
| performance | да (GC/alloc/ValueTask) | специальный нужен ✅ |
| reviewer | нет (.NET в skills) | общий → code-reviewer УДАЛИТЬ |
| debugger | нет (.NET в skills) | общий → bug-hunter УДАЛИТЬ |
| security | нет (.NET в skills) | общий + усиления (threat-model) |

## Дыры/спорное — статус
- Python tester/coder — вне скоупа (решение пользователя). Не делаем.
- Арх-ревью выделенным агентом — НЕ нужен (закрыт фокусом self-reviewer + mr-reviewer).
- **JS/TS-архитектор — пока НЕ создаём.** По критерию (стек в теле артефакта)
  оправдан так же, как architect-dotnet (NestJS/Prisma/BullMQ в Phase 4/6). Но под
  него мало архитектурных JS-skills (есть typescript-patterns/nodejs-api/react —
  тоньше .NET-набора из 10+ skills) → отдельный агент сейчас выродится в дубль
  общего architect с обёрткой `если JS`. Решение: для JS-фичи autonomous-task
  зовёт общий dex-architect + условные JS-skills. Пересмотреть, когда наберётся
  критмасса JS-arch-skills (NestJS-модули, Prisma-моделирование, Node-resilience).
  Отсутствие JS-архитектора = историческая дыра .NET-центричного репо, не отказ.

## Что НЕ трогаем
- mr-reviewer, self-reviewer — свои треки, зрелые. Не меняем.
- dotnet-tester, dotnet-coder, dotnet-performance, dotnet-debugger (bug-hunter) —
  специальные, оправданы идиоматикой. Не трогаем (кроме триггеров bug-hunter).

## Состояние созданного в сессии (ветка feature/ts-dev-roles, НЕ закоммичено)
- dex-skill-ts-vitest-jest ✅
- dex-ts-tester (+ /ts-test) ✅
- dex-debugger (+ /root-cause) ✅ — нужна развязка триггеров с bug-hunter
- dex-security-reviewer (+ /security-scan) ⚠️ — нужна переработка в threat-model
- marketplace.json 5.7.0 → 5.10.0, bundle ts-fullstack 1.2.0 → 1.3.0

## Открытые задачи (порядок)
1. Переработать dex-security-reviewer в threat-model-агента (не клон self-reviewer).
2. Развести триггеры dex-debugger ↔ dotnet bug-hunter.
3. Удалить dex-dotnet-reviewer: измерить радиус → починить bundle/docs/marketplace
   → удалить → пересчитать версии (major где ссылается, minor каталога).
4. npm run validate = 0.
5. commit + PR в develop — ТОЛЬКО по явной команде пользователя («пока не сливаем»).

## Риски
- Удаление code-reviewer = breaking change в 2 bundle. Чинить includes, bump major.
- Угол security-агента: если threat-model не даёт реального углубления над
  self-reviewer — он всё же дубль. Проверить содержанием, не структурой.
- НЕ коммитить/пушить/PR без явной команды. docs/autonomous/ — рабочий, не в код-MR.
