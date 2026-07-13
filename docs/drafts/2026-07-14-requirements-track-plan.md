# Трек «Требования»: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить в AI-SDLC конвейер недостающий первый трек «Требования» - от сырой идеи до BRD, с человеком в петле.

**Architecture:** Трек - дельта-файл в `autonomous-task/tracks/` + строка в таблице треков `SKILL.md`. Исполнитель трека - существующий агент `business-requirements-analyst`, приводимый к контракту узла (`node-contract`). Карта покрытия `DEV_PROCESS_COVERAGE.md` синхронизируется. Кода нет: все артефакты - markdown + JSON-манифесты.

**Tech Stack:** Markdown-артефакты плагинов Claude Code; валидаторы `tools/validate-{agent,skill,command,bundle}.js` (Node); semver в `plugin.json` + `.claude-plugin/marketplace.json`.

**Спека:** `docs/drafts/2026-07-14-requirements-track-design.md`
**Ветка:** `feat/requirements-track` (уже создана от `origin/develop`, спека закоммичена)

## Global Constraints

- **Пунктуация в артефактах - ASCII.** `-` вместо `—`/`–`, `->` вместо `→`, `<=`/`>=` вместо `≤`/`≥`, `...` вместо `…`. Не трогать: кавычки «», box-drawing (`│├└─`), эмодзи-статусы. Тронул файл - приводишь его к ASCII целиком.
- **Версии бампаются в двух местах одновременно:** `<plugin>/.claude-plugin/plugin.json` **и** `.claude-plugin/marketplace.json`. Несогласованность - частая ошибка.
- **Версия каталога** (верхнеуровневое `version` в `marketplace.json`) **не бампается**: новый плагин не добавляется.
- **`npm run validate` - 0 ошибок** перед каждым коммитом. Мягкого режима нет, CI блокирует PR.
- **Артефакты пишутся для LLM:** механизм, условие, исход. Без воды, без пересказа, без процедур-инструкций внутри фаз агента.
- **Формулировка не должна допускать тихий пропуск шага.** Уход от проверки - явный статус (`n/a` + почему, `unverifiable`), не молчание.
- **Размер process-skill - жёсткий потолок 600 строк (`ERROR`, не warning).** `autonomous-task/SKILL.md` уже **551 строка**: запас всего ~47. Правки в него - строго точечные (3 строки), раздувать таблицу треков прозой нельзя. Дельта трека уходит в `tracks/requirements.md` - отдельный файл, в этот лимит не входит.

---

### Task 1: Трек «Требования» в движке

**Files:**
- Create: `plugins/ai-sdlc/dex-skill-autonomous-task/skills/autonomous-task/tracks/requirements.md`
- Modify: `plugins/ai-sdlc/dex-skill-autonomous-task/skills/autonomous-task/SKILL.md` (строки 95, 182, 454)
- Modify: `plugins/ai-sdlc/dex-skill-autonomous-task/.claude-plugin/plugin.json` (version)
- Modify: `.claude-plugin/marketplace.json` (version плагина `dex-skill-autonomous-task`)

**Interfaces:**
- Produces: трек `Требования` с артефактом BRD; карта `трек -> tracks/requirements.md`; `DoD` трека = `DoR` трека «Согласование/Спецификация».
- Consumes: ничего (первый трек конвейера).

- [ ] **Step 1: Зафиксировать baseline валидатора**

Run: `npm run validate`
Expected: PASS, 0 ошибок (baseline до правок; если уже красный - остановиться и разобраться, не накладывать правки на красное).

- [ ] **Step 2: Создать файл дельты трека**

Create `plugins/ai-sdlc/dex-skill-autonomous-task/skills/autonomous-task/tracks/requirements.md`:

```markdown
# Трек «Требования» - дельта сверх таблицы

> Дополнение к строке «Требования» таблицы треков в `SKILL.md`. Ядро читает этот файл,
> определив трек (mandatory-Read из шага 1) - до плана. Якоря `I-decide`/`P-fact` - в `SKILL.md`.

*Цель = согласованный BRD уровня эпика, спецификации и кода ещё нет; верификация = дефекты
требований устранены + бизнес-вопросы приняты автором.* Вход - **сырая идея/бриф** ИЛИ
**возврат с дефектом** от нижнего узла (см. «Второй режим входа»).

## Граница трека - код не открываем

**Трек с кодом не сверяется.** Ни для проверки «уже реализовано», ни для оценки выполнимости.
Сверка с кодом - слот трека «Согласование/Спецификация» (там она обязательна: *уже в коде* /
*реальный остаток* / *против ADR*). Два трека, читающие код, делают одну работу и расходятся
в выводах.

Следствие: невыполнимое требование здесь не ловится - вскроется системным анализом на
«Спецификации» и вернётся возвратом. Это принятая цена, не пробел.

**Трек не решает «как».** Паттерн, границы транзакции, синхронный вызов против outbox - это
`I-decide` трека «Проектирование». BRD пишет «отмена отражается в статусе не позднее 3 с (p99)»,
не «через outbox».

**Единица - эпик, не инкремент.** BRD порождает несколько задач. Спека уровня инкремента -
следующий трек.

## Конвейер

1. **Бизнес-анализ.** Проблема, для кого, как решают сейчас, что будет, если не решать. Use
   cases (primary / alternative / edge), stakeholders, риски с mitigation, границы scope.
2. **Формализация требований.** Нумерованные `FR-NNN` (функциональные, приоритет MoSCoW) и
   `NFR-NNN` (нефункциональные). **Каждое FR несёт проверяемый критерий; каждое NFR несёт
   число.** Требование без критерия/числа - дефект, не «уточним позже».
3. **Проверка требований как артефакта.** Прогнать на дефекты: противоречие (между
   требованиями либо с инвариантом/`Accepted` ADR), неполнота (описан только happy path),
   неоднозначность (нет проверяемого критерия), невыполнимость. **Дефект устраняется здесь,
   не выносится в реализацию.**
4. **Проверка НФТ на осмысленность.** NFR без числа, SLA без SLO/SLI, availability вместо
   uptime, забытый p99; security-ось: классификация данных, модель авторизации, audit log,
   multi-tenant. Пропущенная ось - дыра в BRD, не «инженеры решат».
5. **BRD.** Обязательные разделы - ниже.
6. **Финал.** Бизнес-вопросы держим списком, **не блокируясь**: инженерной части здесь нет,
   но анализ и формализацию добиваем. Апрув автора -> `status: approved` в metadata.

## Обязательные разделы BRD

`metadata` (type, status `draft`->`review`->`approved`, owner, updated) · Executive Summary ·
Business Context · Stakeholders (RACI) · Use Cases · Requirements (`FR-NNN` + `NFR-NNN`) ·
Метрики успеха **и Anti-metrics** · Risks & Mitigation · **Out of Scope** · **Открытые
бизнес-вопросы** · **Допущения** · Epics (опц.).

Три раздела несут вес в автономном конвейере ниже: **Out of Scope** (без него автономный узел
не знает границы и додумывает), **Допущения** и **Открытые вопросы** (по `node-contract` решения
узла обязаны быть в выходе - им нужно место).

`Implementation Plan` (фазы, вехи, зависимости) в BRD **не входит**: съезжает в «как» и
дублирует `epic-planning`/`roadmap-planner`.

## Куда кладём BRD

Путь **не задаётся треком** - берётся из проекта (`CLAUDE.md` / `RULES.md` / memory, таблица
«Адаптация под проект»). Факт неизвестен -> выясни и запиши в memory, не выдумывай и не
замирай.

## Сквозная нить идентификаторов

`FR-NNN`/`NFR-NNN`, заведённые здесь, - **сквозной ключ конвейера**, а не локальная нумерация:

```
BRD              FR-001, NFR-001
 -> спека        критерий приёмки помечен [FR-001]
 -> handoff      requirements R = FR-001/NFR-001 (I добавляет исполнитель из конвенций)
 -> тест         оракул = success criteria                 [FR-001]
 -> self-review  intent = [FR-*] из спеки
```

Коллизия букв, которую держим в голове: в `node-contract` поле `requirements R/I` - ось
**происхождения** (R = явное из ТЗ, I = неявное из конвенций); `FR`/`NFR` - ось **природы**
(функциональное / нефункциональное). BRD нумерует по природе; вниз эти требования едут как `R`.
Новых полей контракта не нужно - `FR`/`NFR` это метки внутри существующих значений.

Нить даёт проверяемый гейт на каждом стыке: *FR без критерия приёмки*, *тест без FR*. Требование
без номера в нить не попадает и ниже по конвейеру теряется - **нумеруй всё**.

## Режим и вопросы

**Дефолт - интерактивный (оператор в loop).** Требования собираются диалогом: показываешь
материал, обсуждаешь, итерируешь. Бизнес-вопрос адресуешь автору **вопросом-с-предложением**
(«принял X, потому что Y; подтверди или поправь»), не голым «как надо?» - голый вопрос это та
же остановка, переложенная на человека. BRD держит предложенный дефолт, а не пустой вопрос.

**Инженерия сюда не протаскивается.** Вопрос, ответ на который лежит в коде или в инженерном
взвешивании, на этом треке не задаётся автору и не решается: он **вне scope трека** и уходит
в «Спецификацию». Не «уточните, какой паттерн валидации» - этого вопроса здесь просто нет.

## Второй режим входа - возврат с дефектом

Узел ниже по конвейеру вернул `status: blocked` с дефектом требования (противоречие,
неописанный кейс) - оркестратор эскалировал сюда. Работа **точечная**: закрыть названный
дефект, не переписывать BRD.

**Починка = новая ревизия BRD** (коммит в документ, не устная правка в чате). BRD апрувнут и
лежит в VCS; иначе код расходится с требованиями в момент рождения, и трассировка
`FR -> success criteria -> тест` начинает врать.

## Саморевью трека

Каждое ли FR несёт проверяемый критерий, каждое ли NFR - число; устранён ли каждый дефект
требований (не «вынесен в реализацию»); есть ли Out of Scope, Допущения, Открытые вопросы;
не протащена ли инженерия в бизнес-вопросы; не открывался ли код; нет ли LLM-маркеров.
```

- [ ] **Step 3: Вставить строку трека в таблицу `SKILL.md`**

Modify `SKILL.md`. Найти строку 182 (начинается с `| **Согласование/Спецификация** |`) и вставить **перед ней** новую строку - трек первый в конвейере:

```markdown
| **Требования** | сырая идея/бриф -> бизнес-анализ (use cases, stakeholders, риски) -> нумерованные `FR`/`NFR` -> проверка на дефекты требований -> проверка НФТ на осмысленность | каждый дефект требований устранён (противоречие/неполнота/неоднозначность/невыполнимость); каждое FR с проверяемым критерием, каждое NFR с числом **И** бизнес-вопросы приняты автором | BRD (место - из проекта); **код не пишем и с кодом не сверяем**; трекер: эпик заведён |
```

- [ ] **Step 4: Добавить трек в карту «трек -> файл» (шаг 1 цикла)**

Modify `SKILL.md`, строка 95. Было:

```
   трека, не все. Карта трек->файл: Согласование/Спецификация -> `specification.md`;
```

Стало:

```
   трека, не все. Карта трек->файл: Требования -> `requirements.md`; Согласование/Спецификация -> `specification.md`;
```

- [ ] **Step 5: Добавить строку в таблицу «Адаптация под проект»**

Modify `SKILL.md`. Найти строку 454 (`| Куда складывать отчёты (root-cause, разбор) | ...`) и вставить **после неё**:

```markdown
| Куда складывать BRD/спеки | `CLAUDE.md`/конвенции проекта |
```

- [ ] **Step 6: Бампнуть версию плагина (minor - новая категория)**

Modify `plugins/ai-sdlc/dex-skill-autonomous-task/.claude-plugin/plugin.json`: `"version": "1.3.0"` -> `"version": "1.4.0"`

Modify `.claude-plugin/marketplace.json`: в объекте плагина `dex-skill-autonomous-task` то же самое - `1.3.0` -> `1.4.0`.

- [ ] **Step 7: Прогнать валидатор**

Run: `npm run validate`
Expected: PASS, 0 ошибок. Красный `process-empty` на `autonomous-task` означает, что трек-файл не считается частью skill - разобраться, не подавлять.

- [ ] **Step 8: Проверить размер и ASCII**

Run: `wc -l plugins/ai-sdlc/dex-skill-autonomous-task/skills/autonomous-task/tracks/requirements.md && rg -n '[—–→←≤≥≠…]' plugins/ai-sdlc/dex-skill-autonomous-task/skills/autonomous-task/tracks/requirements.md plugins/ai-sdlc/dex-skill-autonomous-task/skills/autonomous-task/SKILL.md`
Expected: файл трека < 150 строк (`specification.md` для сравнения - 72). Трек-файлы в лимит `SKILL.md` не входят, но раздувать их нельзя: они читаются mandatory-Read'ом на каждом запуске трека. `rg` не находит ничего (exit 1).

Отдельно - `SKILL.md` после правок: `wc -l` должен дать **553** (было 551, потолок process-skill 600 = ERROR). Больше 553 = в таблицу треков просочилась проза, резать.

- [ ] **Step 9: Коммит**

```bash
git add plugins/ai-sdlc/dex-skill-autonomous-task .claude-plugin/marketplace.json
git commit -m "feat(autonomous-task): трек «Требования» - первый вход конвейера

Движок начинался со «Спецификации», которая стартует от присланного
плана - кто собирает требования, не было сказано нигде. Новый трек
закрывает вход: сырая идея -> BRD уровня эпика, человек в петле.

Граница трека: код не открываем (сверка с кодом - работа Спецификации),
«как» не решаем. Единица - эпик, не инкремент."
```

---

### Task 2: Агент `business-requirements-analyst` как узел конвейера

**Files:**
- Modify: `plugins/specialists/product/dex-business-analyst/agents/business-requirements-analyst.md`
- Modify: `plugins/specialists/product/dex-business-analyst/.claude-plugin/plugin.json` (version)
- Modify: `plugins/bundles/dex-bundle-product-manager/bundle.json` (includes)
- Modify: `plugins/bundles/dex-bundle-product-manager/.claude-plugin/plugin.json` (version)
- Modify: `.claude-plugin/marketplace.json` (versions обоих плагинов)

**Interfaces:**
- Consumes: трек `Требования` из Task 1 (агент - его исполнитель).
- Produces: `Output (handoff)` = `status` + путь BRD + перечень `FR`/`NFR` + открытые вопросы + допущения. Это вход трека «Согласование/Спецификация».

**Почему агент и бандл в одной задаче:** валидатор требует замкнутости бандла по скиллам его агентов (`bundle-not-closed`). Добавить агенту `dex-skill-nfr` и `dex-skill-node-contract`, не пополнив `includes[]`, = красный валидатор. Разделять нельзя.

- [ ] **Step 1: Шапка файла - frontmatter, модель, вводная строка**

Modify `business-requirements-analyst.md`, строки 1-6. Было:

```yaml
---
name: business-requirements-analyst
description: Формализует бизнес-идеи в структурированные требования, анализирует use cases, выявляет риски, создаёт BRD и epics. Триггеры — бизнес требования, business requirements, формализовать идею, analyze idea, план реализации, create epic, BRD, risk analysis, stakeholder analysis, use case analysis, SWOT, decomposition, requirements document, бизнес-анализ, problem statement, feasibility
tools: Read, Write, Edit, Grep, Glob, Skill
model: sonnet
---
```

Стало (`model: opus` - работа фальсификационная, цена ошибки на входе конвейера максимальная; в description добавлена сжатая сигнатура handoff; ASCII-тире):

```yaml
---
name: business-requirements-analyst
description: Формализует бизнес-идеи в структурированные требования - use cases, риски, BRD, epics. Исполнитель трека «Требования»: код не открывает, выполнимость не оценивает. Handoff - принимает сырую идею/бриф (+ constraints), отдаёт BRD с нумерованными FR/NFR, открытыми вопросами и допущениями. Триггеры - бизнес требования, business requirements, формализовать идею, analyze idea, create epic, BRD, risk analysis, stakeholder analysis, use case analysis, requirements document, бизнес-анализ, problem statement, feasibility
tools: Read, Write, Edit, Grep, Glob, Skill
model: opus
skills: dex-skill-node-contract
---
```

Там же - вводная строка 10. Было:

```markdown
Трансформирует бизнес-идеи от расплывчатой концепции до структурированного BRD с рисками, stakeholders и планом реализации. Включает создание epics как часть decomposition.
```

Стало (план реализации из BRD уходит - строка обязана перестать его обещать):

```markdown
Трансформирует бизнес-идеи от расплывчатой концепции до структурированного BRD: use cases, риски, stakeholders, нумерованные FR/NFR. Включает создание epics как часть decomposition. Исполнитель трека «Требования» автономного движка.
```

- [ ] **Step 2: Input (handoff) в Phase 1**

Modify `business-requirements-analyst.md`, Phase 1. Добавить перед `**Goal:**` строку:

```markdown
**Input (handoff):** контракт стыка - в pre-loaded `node-contract`. Принимает: `mode`, сырая идея/бриф, `constraints`.

**`mode` без поля -> `interactive`** - переопределение общего дефолта `node-contract` (`autonomous`). Трек «Требования» human-in-loop по построению: бизнес-решения принимает автор, а не узел. Прецедент - трек «Согласование/Спецификация», который так же объявляет интерактив дефолтом. `autonomous` - только по явному opt-in оператора.

**Бизнес-ось входа не обязательна: сырая идея и есть работа агента** - `blocked` по нехватке требований здесь не возвращается (в отличие от узлов ниже, где `requirements`/`success criteria` - halt). Пустой вход (ни идеи, ни брифа) -> `status: blocked`: анализировать нечего, не выдумывать проблему за автора.

Вопрос автору - всегда **вопрос-с-предложением** («принял X, потому что Y; подтверди или поправь»). Голый вопрос - та же остановка, переложенная на человека; BRD должен держать предложенный дефолт, а не пустое место.
```

- [ ] **Step 3: Подключить skill `nfr` в Phase 3**

Modify `business-requirements-analyst.md`, Phase 3 «Skill-Based Deep Scan», блок «Загрузить через Skill tool». Добавить третьим пунктом:

```markdown
- `dex-skill-nfr:nfr` - проверить НФТ на осмысленность: NFR без числа, SLA без SLO/SLI, availability вместо uptime, забытый p99; security-ось - классификация данных, модель авторизации, secrets, audit log в оценке хранилища, multi-tenant без tenant_id. Пропущенная ось - дыра в BRD, не «инженеры решат».
```

Расширить `**Exit criteria:**` фазы - было:

```
**Exit criteria:** Все обязательные секции BRD покрыты или помечены «intentionally skipped» с обоснованием; каждое требование проверено на дефекты артефакта, неоднозначные снабжены измеримым критерием приёмки.
```

Стало (плюс строка `Mandatory` - у Phase 3 её сейчас нет, и проверку на дефекты можно тихо пропустить):

```
**Exit criteria:** Все обязательные секции BRD покрыты или помечены «intentionally skipped» с обоснованием; каждое требование проверено на дефекты артефакта, неоднозначные снабжены измеримым критерием приёмки; каждое NFR несёт число и проверено по осям nfr-skill. Дефект устранён здесь, не вынесен в реализацию.

**Mandatory:** yes - непроверенные требования отравляют весь конвейер ниже: дефект, пропущенный здесь, всплывает как переделка в разработке или как расхождение кода с ТЗ на приёмке.
```

- [ ] **Step 4: Состав BRD в Phase 4 + Output (handoff)**

Modify `business-requirements-analyst.md`, Phase 4. Было (строки 66-75, дословно):

```markdown
**Output:** Business Requirements Document:

- Executive Summary: problem, solution, expected benefits
- Business Context: current state, strategic alignment, objectives
- Stakeholders: map с RACI
- Use Cases: primary + alternative flows + business rules
- Requirements: functional (FR-xxx) и non-functional (NFR-xxx)
- Risks & Mitigation
- Implementation Plan: phases, milestones, dependencies
- Epics: если требуется decomposition — high-level epics с business value, success metrics, estimated effort (T-shirt), target quarter
```

Стало:

```markdown
**Output:** Business Requirements Document:

- `metadata`: type, status (`draft` -> `review` -> `approved`), owner, updated
- Executive Summary: problem, solution, expected benefits
- Business Context: current state, strategic alignment, objectives
- Stakeholders: map с RACI
- Use Cases: primary + alternative + edge flows + business rules
- Requirements: `FR-NNN` (MoSCoW-приоритет, проверяемый критерий) и `NFR-NNN` (число обязательно)
- Метрики успеха + **Anti-metrics** (ограничение, которое нельзя ухудшить в погоне за метрикой)
- Risks & Mitigation
- **Out of Scope**: что явно НЕ входит
- **Открытые бизнес-вопросы**: каждый - вопросом-с-предложением («принял X, потому что Y»), не голым вопросом
- **Допущения**: всё, что решено за отсутствующего автора
- Epics: если требуется decomposition - high-level epics с business value, success metrics, estimated effort (T-shirt), target quarter

Место BRD **не хардкодится** - берётся из проекта (`CLAUDE.md`/`RULES.md`/memory). Факт неизвестен -> выяснить и записать, не выдумывать путь.

`Implementation Plan` (фазы, вехи, зависимости) в BRD не входит: съезжает в «как» и дублирует `epic-planning`/`roadmap-planner`.

**Output (handoff):** по контракту `node-contract` первым полем `status` (`complete`/`blocked`/`partial`; `blocked`/`partial` не маскировать под `complete`), затем: путь к BRD, перечень `FR`/`NFR`, открытые бизнес-вопросы, допущения. Это вход трека «Согласование/Спецификация»; маршрут решает оркестратор.
```

Расширить `**Exit criteria:**` Phase 4 - было:

```
**Exit criteria:** Документ сохранён. Requirements пронумерованы. Epics (если созданы) связаны с requirements.
```

Стало:

```
**Exit criteria:** Документ сохранён по пути из конвенций проекта. Requirements пронумерованы (`FR-NNN`/`NFR-NNN`). Разделы Out of Scope, Допущения, Открытые вопросы присутствуют (пустой раздел - только с явной пометкой «нет», не молчанием). Epics (если созданы) связаны с requirements.
```

- [ ] **Step 5: Boundaries - граница трека**

Modify `business-requirements-analyst.md`, секция `## Boundaries`. Добавить первым пунктом:

```markdown
- Не открывать код и не оценивать техническую выполнимость требования - это трек «Согласование/Спецификация» (там сверка с кодом обязательна). Невыполнимое требование вскроется там и вернётся возвратом; здесь оно не ловится, и это принятая цена, не пробел.
```

Строку «Не писать user stories - это SA/user-story-writer» **оставить**: агент `dex-user-story-writer` существует в каталоге (проверено), ссылка валидна.

- [ ] **Step 6: Привести файл агента к ASCII-пунктуации целиком**

Файл сейчас **сплошь на em-dash** (`—` в описании, в Phase 2/3, в Boundaries - строки 40, 44, 55, 56, 75, 89-93 и др.). Глобальное правило: тронул файл - приводишь его к ASCII целиком, а не только свои строки.

Замены по всему файлу: `—`/`–` -> `-`, `→` -> `->`, `≤`/`≥` -> `<=`/`>=`, `…` -> `...`. **Не трогать** кавычки «», box-drawing, эмодзи.

Run: `rg -n '[—–→←≤≥≠…]' plugins/specialists/product/dex-business-analyst/agents/business-requirements-analyst.md`
Expected: после правок - ничего не найдено (exit 1). До правок - ~10+ попаданий; это ожидаемо, файл писался до введения правила.

- [ ] **Step 7: Замкнуть бандл по новым скиллам**

Modify `plugins/bundles/dex-bundle-product-manager/bundle.json`. Было:

```json
{
  "includes": [
    "dex-business-analyst",
    "dex-roadmap-planner",
    "dex-backlog-manager",
    "dex-pm-metrics-analyst",
    "dex-skill-agile",
    "dex-skill-product-discovery",
    "dex-skill-epic-planning",
    "dex-skill-prioritization",
    "dex-skill-doc-standards",
    "dex-skill-requirement-quality"
  ]
}
```

Стало:

```json
{
  "includes": [
    "dex-business-analyst",
    "dex-roadmap-planner",
    "dex-backlog-manager",
    "dex-pm-metrics-analyst",
    "dex-skill-agile",
    "dex-skill-product-discovery",
    "dex-skill-epic-planning",
    "dex-skill-prioritization",
    "dex-skill-doc-standards",
    "dex-skill-requirement-quality",
    "dex-skill-nfr",
    "dex-skill-node-contract"
  ]
}
```

- [ ] **Step 8: Версии**

- `plugins/specialists/product/dex-business-analyst/.claude-plugin/plugin.json`: `1.2.0` -> `2.0.0` (**major**: изменён output format агента - semver-таблица `CLAUDE.md`).
- `plugins/bundles/dex-bundle-product-manager/.claude-plugin/plugin.json`: `1.2.0` -> `1.3.0` (minor: изменён состав bundle).
- `.claude-plugin/marketplace.json`: те же две версии.

- [ ] **Step 9: Валидатор**

Run: `npm run validate`
Expected: PASS, 0 ошибок. Частые падения здесь: `bundle-not-closed` (забыт скилл в `includes[]`), description > 750 символов (hard cap - error).

- [ ] **Step 10: Проверить длину description**

Run: `node -e "const fm=require('fs').readFileSync('plugins/specialists/product/dex-business-analyst/agents/business-requirements-analyst.md','utf8').match(/^description: (.*)$/m)[1]; console.log('description:', fm.length, 'символов')"`
Expected: <= 750 (`PROJECT_DESCRIPTION_MAX`, error) и желательно <= 500 (`WARN_DESCRIPTION_LENGTH`, warning). Превысил - резать сигнатуру handoff, **триггеры-активаторы держать**: без них агент не выбирается по запросу пользователя.

- [ ] **Step 11: Коммит**

```bash
git add plugins/specialists/product/dex-business-analyst plugins/bundles/dex-bundle-product-manager .claude-plugin/marketplace.json
git commit -m "feat(business-analyst)!: агент-узел трека «Требования»

BREAKING CHANGE: изменён output format BRD - убран Implementation Plan
(съезжает в «как», дублирует epic-planning), добавлены обязательные
Out of Scope, Допущения, Открытые вопросы. Добавлен Output (handoff)
по node-contract.

Закрыта дыра: НФТ никто не проверял на осмысленность - подключён
dex-skill-nfr (числа, SLA/SLO/SLI, p99, security-ось).

model sonnet -> opus: работа агента это выявление противоречий между
требованиями (фальсификация), цена ошибки на входе конвейера максимальная.

Бандл product-manager замкнут по новым скиллам (bundle-not-closed)."
```

---

### Task 3: Карта покрытия процесса

**Files:**
- Modify: `docs/DEV_PROCESS_COVERAGE.md` (таблица «Треки автономного движка -> исполнители», строки 17-26)

**Interfaces:**
- Consumes: трек из Task 1, агент из Task 2.
- Produces: ничего (терминальный документ-карта).

**Контекст:** в карте отсутствует не только строка «Требования», но и строка «Согласование/Спецификация» - трек в движке есть, а исполнитель в карте не назван. Чиним обе дыры разом: карта и движок должны сойтись один-в-один.

- [ ] **Step 1: Добавить две строки в таблицу треков**

Modify `docs/DEV_PROCESS_COVERAGE.md`. В таблице «Треки автономного движка -> исполнители» (шапка: `| Трек движка | Исполнитель (.NET / общий) | Артефакт |`) вставить **первыми** двумя строками тела - непосредственно перед существующей строкой `| **Разработка** (фича / баг-фикс / рефакторинг) | детальная слот-карта ниже | MR/коммиты |`:

```markdown
| **Требования** (сырая идея -> BRD) | dex-business-analyst | BRD (место - из конвенций проекта) |
| **Согласование/Спецификация** | dex-business-analyst (бизнес-ось) + системный анализ сверкой с кодом | спец-документ + тред автору |
```

- [ ] **Step 2: Отразить границу между треками в тексте под таблицей**

Modify `docs/DEV_PROCESS_COVERAGE.md`. После абзаца, начинающегося «Под-виды «Разработки» используют ту же слот-карту...», добавить абзац:

```markdown
**Требования и Спецификация - разные треки, не дубль.** «Требования» работают на уровне эпика
и **с кодом не сверяются** (выход - BRD: `FR`/`NFR`, риски, Out of Scope). «Спецификация»
работает на уровне инкремента и сверка с кодом там обязательна (*уже в коде* / *реальный
остаток* / *против ADR*). `DoD` требований = `DoR` спецификации.
```

- [ ] **Step 3: Проверить ASCII**

Run: `rg -n '[—–→←≤≥≠…]' docs/DEV_PROCESS_COVERAGE.md`
Expected: ничего не найдено (exit 1). Файл тронут - привести к ASCII целиком, если найдётся старый Unicode.

- [ ] **Step 4: Валидатор (карта не валидируется, но прогон обязателен перед коммитом)**

Run: `npm run validate`
Expected: PASS, 0 ошибок.

- [ ] **Step 5: Коммит**

```bash
git add docs/DEV_PROCESS_COVERAGE.md
git commit -m "docs(coverage): треки «Требования» и «Спецификация» в карте покрытия

Карта не знала исполнителя ни для нового трека требований, ни для
существующей «Спецификации» - строки не было вовсе. Движок и карта
сведены один-в-один, граница между треками зафиксирована."
```

---

### Task 4: Сквозная проверка и PR

**Files:**
- Modify: `docs/drafts/2026-07-14-requirements-track-design.md` (снять открытый вопрос про `model`)

**Interfaces:**
- Consumes: результат Tasks 1-3.

- [ ] **Step 1: Снять закрытый открытый вопрос в спеке**

Modify `docs/drafts/2026-07-14-requirements-track-design.md`. Раздел `## Открытые вопросы`. Было:

```markdown
## Открытые вопросы

- `model` агента: `opus` (предложено) против `sonnet` (текущий). Решение за владельцем.
```

Стало:

```markdown
## Решённые развилки

- `model` агента: **`opus`** (решено 2026-07-14). Работа фальсификационная, цена ошибки на
  входе конвейера максимальная. Отвергнуто: `sonnet` (human-in-loop страхует лишь частично).
```

- [ ] **Step 2: Полный прогон валидатора**

Run: `npm run validate`
Expected: PASS, 0 ошибок по всем четырём валидаторам (agents, skills, commands, bundles).

- [ ] **Step 3: Сверить версии в двух местах**

Run: `for p in dex-skill-autonomous-task dex-business-analyst dex-bundle-product-manager; do echo "$p: manifest=$(jq -r --arg n "$p" '.plugins[]|select(.name==$n)|.version' .claude-plugin/marketplace.json)"; done; jq -r '.version' .claude-plugin/marketplace.json | xargs echo "версия каталога (не должна была меняться):"`
Expected: `dex-skill-autonomous-task: 1.4.0`, `dex-business-analyst: 2.0.0`, `dex-bundle-product-manager: 1.3.0`; версия каталога - без изменений относительно `origin/develop`.

Дополнительно: `git diff origin/develop --stat -- .claude-plugin/marketplace.json` - убедиться, что верхнеуровневый `version` каталога не тронут.

- [ ] **Step 4: Сверить plugin.json == marketplace.json**

Run: `for p in plugins/ai-sdlc/dex-skill-autonomous-task plugins/specialists/product/dex-business-analyst plugins/bundles/dex-bundle-product-manager; do n=$(jq -r '.name' $p/.claude-plugin/plugin.json); v=$(jq -r '.version' $p/.claude-plugin/plugin.json); m=$(jq -r --arg n "$n" '.plugins[]|select(.name==$n)|.version' .claude-plugin/marketplace.json); [ "$v" = "$m" ] && echo "OK $n $v" || echo "РАСХОЖДЕНИЕ $n: plugin.json=$v marketplace.json=$m"; done`
Expected: три строки `OK`. Любое `РАСХОЖДЕНИЕ` - чинить до коммита (частая ошибка репо).

- [ ] **Step 5: Коммит и push**

```bash
git add docs/drafts/2026-07-14-requirements-track-design.md
git commit -m "docs(drafts): model агента решён - opus"
git push -u origin feat/requirements-track
```

- [ ] **Step 6: PR**

```bash
gh pr create --base develop --title "feat: трек «Требования» - первый вход AI-SDLC конвейера" --body "$(cat <<'EOF'
## Проблема

Конвейер `autonomous-task` начинался не с начала. Трек «Спецификация» стартует от **присланного плана** - а кто собирает требования, не сказано нигде: трека нет в движке, строки нет в карте покрытия, агент `business-requirements-analyst` не привязан ни к одному треку.

## Что сделано

- **Новый трек «Требования»** (`tracks/requirements.md` + строка в таблице треков): сырая идея -> BRD уровня эпика, человек в петле.
- **Граница трека:** код не открываем, выполнимость не оцениваем - это работа «Спецификации». Два трека, читающие код, делают одну работу и расходятся.
- **Агент как узел:** `node-contract` pre-load, `Input`/`Output` handoff, `model: opus`.
- **Закрыта дыра с НФТ:** агент не грузил `dex-skill-nfr` - НФТ никто не проверял на осмысленность (числа, SLA/SLO/SLI, p99, security-ось).
- **Формат BRD:** добавлены обязательные `Out of Scope`, `Допущения`, `Открытые вопросы`; удалён `Implementation Plan` (съезжает в «как»).
- **Карта покрытия** сведена с движком: добавлены строки «Требования» и «Спецификация» (последней не было вовсе).

## Трассировка

`FR`/`NFR` из BRD едут дальше метками внутри существующих полей `node-contract` (`requirements`, `success criteria`, `intent`) - **новых полей контракта не потребовалось**. На каждом стыке появляется проверяемый гейт: «FR без success criterion», «тест без FR».

## Версии

`dex-skill-autonomous-task` 1.3.0 -> 1.4.0 (minor) · `dex-business-analyst` 1.2.0 -> **2.0.0** (major: изменён output format) · `dex-bundle-product-manager` 1.2.0 -> 1.3.0 (minor: состав bundle). Версия каталога не бампалась - новый плагин не добавлялся.

## Дизайн

`docs/drafts/2026-07-14-requirements-track-design.md`

## Заметка по issue #110

Пункт «`skills:` во frontmatter запрещён» **устарел**: issue создан 2026-06-29, а pre-load `skills:` узаконен позже (PR #107, 2026-07-01) и разрешён валидатором (`ALLOWED_PRELOAD_SKILLS = {node-contract}`). Этот PR сознательно использует `skills:` для узла. Пункт в #110 стоит поправить.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Вне scope этого плана

- Треки «Приёмка на стенде» и «Аналитика/ресёрч» (агенты есть, дельты трека нет) - отдельные задачи.
- Привязка к трекам агентов `review-planner`, `conflict-resolver`, `code-discovery`, продуктового блока.
- Задача 110 целиком (переработка 57 агентов).
- **Установка `dex-skill-node-contract` на рабочую машину** - действие вне репозитория. Плагин есть в каталоге (v1.0.0, PR #107), но не установлен: 18 плагинов объявляют его pre-loaded и сейчас работают без контракта стыка.
