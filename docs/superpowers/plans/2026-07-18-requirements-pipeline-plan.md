# Requirements Pipeline + пересмотр треков движка — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ввести три интерактивных контура порождения/согласования требований и дизайна (`/feature`, `/review-requirements`, `/review-design`), сдвинуть движок `autonomous-task` к работе строго от задачи (удалить 3 до-разработочных трека), добавить сквозной механизм приёмки артефактов (метка `quality-checks` + оракул набора требований).

**Architecture:** Три зоны с границей на «задаче»: зона 1 (аналитик, `/feature` создание + `/review-requirements` согласование), зона 2 (архитектор, `/design` создание + `/review-design` согласование), зона 3 (движок от задачи/бага, автономно). Дом логики распадается: формализация в составителях (`business-requirements-analyst`, `user-story-writer`), оркестрация в дирижёре `requirements-orchestrator`, ревью чужого в `requirements-reviewer`/`design-reviewer`, транспорт метки в `node-contract`.

**Tech Stack:** Claude Code plugin marketplace — Markdown-артефакты (agent/command/skill) + JSON-манифесты (`plugin.json`, `marketplace.json`, `bundle.json`); валидаторы `tools/validate-{agent,skill,command,bundle}.js`; `npm run validate`.

**Спека:** `docs/superpowers/specs/2026-07-18-requirements-pipeline-design.md` (13 секций).

## Global Constraints

Копируются в требования КАЖДОЙ задачи, повторять не буду:

- **ASCII-пунктуация в артефактах:** `-` вместо `—`/`–`, `->` вместо `→`, `<-`/`<->`, `<=`/`>=`/`!=`, `...` вместо `…`. НЕ трогать: кавычки «», box-drawing диаграмм, эмодзи-статусы, `№`, Unicode внутри inline code. Единица миграции — файл: тронул файл — привёл к ASCII целиком.
- **Формулировки для LLM, не человека:** механизм + условие + исход, сухо, императив. Перед сдачей каждого artefacta (skill/agent/command) прогнать через skill `optimize-for-llm` (приоритеты: нормативная сила > однозначность > минимум токенов). НЕ применять к README/спеке/плану (их читает человек).
- **Никаких лазеек в нормативном тексте:** любой уход от проверки — явный статус (`n/a`+почему, `unverifiable`, `contradicted`), не молчание. Ветвление `если X -> Y` всегда с `иначе -> что`.
- **Версии в двух местах:** `.claude-plugin/plugin.json` И `.claude-plugin/marketplace.json` — синхронно.
- **Каскад fact-check в tools:** агент с фазой Fact Verification несёт в `tools` весь каскад `ToolSearch` (context7, deferred MCP) + `WebSearch, WebFetch` (fallback). Нет звена — каскад молча деградирует.
- **mandatory-фазы агента требуют обоснования «почему mandatory»** — иначе валидатор упадёт.
- **`description` skill <= 750 символов** (error-порог), <= 500 рекомендация (warning).
- **Финальный гейт каждой задачи:** `npm run validate` — 0 ошибок.

## Порядок фаз (зависимости)

```
Фаза A: node-contract (метка quality-checks + реестр оракулов)  <- фундамент, все узлы грузят
Фаза B: оракул requirement-set-quality (new skill)              <- нужен реестру A и дирижёру
Фаза C: rename adr-authoring -> adr-quality                     <- независим, но реестр A ссылается
Фаза D: составители BA + USW (метка на выходе)                  <- зависят от A (поле quality-checks)
Фаза E: дирижёр requirements-orchestrator + /feature            <- зависит от B, D
Фаза F: requirements-reviewer + /review-requirements            <- зависит от A, B
Фаза G: design-reviewer + /review-design                       <- зависит от A, C
Фаза H: architect + /design (доработка входа)                  <- зависит от A
Фаза I: движок autonomous-task (удаление 3 треков + чистка ссылок) <- зависит от E,H (треки переехали)
Фаза J: синхронизация каталога + OPERATOR_ROLE.md + финальный validate
```

Фазы C, D, отчасти B независимы — можно параллелить. I — последняя (удаляет то, что переехало в E/H).

---

## Фаза A: node-contract — метка quality-checks + реестр оракулов

**Файл:** `plugins/ai-sdlc/dex-skill-node-contract/skills/node-contract/SKILL.md` (194 строки; правки — врезки в существующие разделы, не переписывание).

**Дом каждой вставки (по разведке):**
- поле `quality-checks` -> таблица `## Словарь полей` (строки 116-131), новой строкой;
- правило простановки на выходе -> раздел `### B. Состав и качество выхода`, новым пунктом после п.6 (сквозные поля);
- врезка «Входная приёмка артефакта» -> расширение `### C. Приём входа` (строки 61-67);
- реестр «тип артефакта -> оракул» -> подраздел внутри `## Правила передачи`, рядом с `### Старшинство оракулов при конфликте`.

### Task A1: Поле quality-checks в словарь полей

**Files:**
- Modify: `plugins/ai-sdlc/dex-skill-node-contract/skills/node-contract/SKILL.md` (таблица словаря полей, ~line 131)

**Interfaces:**
- Produces: поле `quality-checks` формы `список {artifact, check, verdict}` — на него ссылаются задачи A2, A3, D1, D2, E, F, G, H.

- [ ] **Step 1: Добавить строку в таблицу `## Словарь полей`** (последней строкой таблицы, после `severity`):

```markdown
| `quality-checks` | какие артефакты уже проверены своим оракулом в этом флоу (сквозное, п.6 раздела B) | список `{artifact, check, verdict}`; ключ - тип артефакта; метка одного типа не закрывает проверку другого |
```

- [ ] **Step 2: Прогнать `optimize-for-llm`** на изменённой строке (сухо, механизм+форма; нормативную силу «ключ - тип артефакта» не резать).

- [ ] **Step 3: Валидировать**

Run: `npm run validate:skills`
Expected: 0 ошибок (node-contract — process-skill в allowlist).

### Task A2: Правило простановки метки на выходе (раздел B)

**Files:**
- Modify: `plugins/ai-sdlc/dex-skill-node-contract/skills/node-contract/SKILL.md` (раздел `### B. Состав и качество выхода`, после п.6, ~line 59)

**Interfaces:**
- Consumes: поле `quality-checks` (Task A1).
- Produces: пункт «узел проставляет метку» — на него ссылаются составители (D1, D2) и ревьюеры (F, G).

- [ ] **Step 1: Добавить пункт 7 в раздел B** (после п.6 про сквозные поля):

```markdown
7. **Узел, проверивший артефакт своим оракулом, проставляет метку в выход.** Составитель на выходе ИЛИ потребитель, прогнавший проверку сам, добавляет запись `{artifact, check, verdict}` в `quality-checks`. Метка накапливается по цепочке (сквозное поле, п.6). `verdict: passed` от узла принимается ниже без перепроверки - узел отвечает за свой выход; ложная метка ловится ревью-контуром, не потребителем.
```

- [ ] **Step 2: `optimize-for-llm`** (не ослаблять «отвечает за свой выход» / «ловится ревью-контуром»).

- [ ] **Step 3: Валидировать**

Run: `npm run validate:skills`
Expected: 0 ошибок.

### Task A3: Врезка «Входная приёмка» + реестр оракулов

**Files:**
- Modify: `plugins/ai-sdlc/dex-skill-node-contract/skills/node-contract/SKILL.md` (расширить `### C. Приём входа` ~line 67 + новый подраздел в `## Правила передачи`)

**Interfaces:**
- Consumes: `quality-checks` (A1), правило простановки (A2), оракулы `requirement-quality`/`requirement-set-quality` (B)/`adr-quality` (C).
- Produces: реестр «тип -> оракул» + правило входной приёмки — на него ссылаются F, G, H (потребители проверяют метку на входе).

- [ ] **Step 1: Добавить пункт 8 в раздел C** (после п.7 «Приёмник проверяет вход»):

```markdown
8. **Входная приёмка артефакта по метке `quality-checks`.** Потребитель на входе смотрит `quality-checks` по типу артефакта, который потребляет:
   - запись `{тип, check, verdict: passed}` есть -> проверку не дублировать (доверие полное, п.7 раздела B);
   - записи нет ИЛИ `verdict != passed` -> прогнать оракул типа по реестру ниже;
   - оракул нашёл дефект -> `status: blocked` + перечень, возврат оркестратору. Потребитель НЕ дочиняет чужой артефакт (чинит автор/составитель).
```

- [ ] **Step 2: Добавить подраздел-реестр в `## Правила передачи`** (после `### Старшинство оракулов при конфликте`):

```markdown
### Реестр «тип артефакта -> оракул»

Метка `quality-checks` и входная приёмка (раздел C, п.8) опираются на соответствие типа артефакта его оракулу:

| Тип артефакта | Оракул | Кто прогоняет |
|---|---|---|
| требование (BRD/story), единица | `requirement-quality` | составитель на выходе ИЛИ потребитель-единица |
| набор требований | `requirement-set-quality` | оркестратор/дирижёр (видит весь набор) |
| ADR | `adr-quality` | автор ADR ИЛИ потребитель |
| API-спека | `api-spec-quality` | задел (оракул создаётся в set-completeness PR, не здесь) |

Реестр держится явной таблицей (точное имя, не вероятностный матч по `description`). По конвенции имя оракула = `{тип}-quality` (см. CLAUDE.md «Именование»).
```

- [ ] **Step 3: `optimize-for-llm`** (терминал каждой ветки в п.8 сохранить: «есть -> ...», «нет -> ...», «дефект -> ...»).

- [ ] **Step 4: Валидировать**

Run: `npm run validate:skills`
Expected: 0 ошибок.

### Task A4: Пересмотреть упоминание «трек Требования» в node-contract

**Files:**
- Modify: `plugins/ai-sdlc/dex-skill-node-contract/skills/node-contract/SKILL.md:120` (строка про `FR`/`NFR` «из трека Требования»)

**Interfaces:**
- Consumes: факт удаления трека (Фаза I).

- [ ] **Step 1: Заменить** в описании поля `requirements R/I` формулировку «из трека "Требования"» на нейтральную «из зоны требований (`/feature`)» — трек удаляется в Фазе I, ссылка на него станет висячей.

Строка 120, фрагмент `(FR/NFR - функциональное/нефункциональное, из трека «Требования»)` -> `(FR/NFR - функциональное/нефункциональное, из зоны требований)`.

- [ ] **Step 2: Bump node-contract** — minor (добавлено поле + правила): `plugin.json` + `marketplace.json`. Текущую версию прочитать из `plugins/ai-sdlc/dex-skill-node-contract/.claude-plugin/plugin.json`, поднять minor.

- [ ] **Step 3: Валидировать**

Run: `npm run validate:skills`
Expected: 0 ошибок.

---

## Фаза B: оракул requirement-set-quality (новый trap-skill)

Новый skill — set-оракул (§5.2.6 ISO 29148: Complete набора, Consistent, Affordable, Bounded, Able to be Validated). Судит МНОЖЕСТВО требований против источника; грузит только оркестратор/дирижёр, не составитель-субагент.

### Task B1: Создать skill requirement-set-quality

**Files:**
- Create: `plugins/skills/dex-skill-requirement-set-quality/.claude-plugin/plugin.json`
- Create: `plugins/skills/dex-skill-requirement-set-quality/skills/requirement-set-quality/SKILL.md`
- Modify: `.claude-plugin/marketplace.json` (новая запись + version каталога)

**Interfaces:**
- Produces: skill-имя `dex-skill-requirement-set-quality:requirement-set-quality` — грузят дирижёр (E), requirements-reviewer (F).

- [ ] **Step 1: Создать plugin.json** (эталон — любой trap-skill; поля `name, version, description, author, keywords, repository, license`):

```json
{
  "name": "dex-skill-requirement-set-quality",
  "version": "1.0.0",
  "description": "Дефекты НАБОРА требований (ISO 29148 §5.2.6): неполнота набора против источника, забытый класс требований, внутренняя противоречивость набора, дубли, разъехавшийся scope, невалидируемость. Для гейтов дирижёра и ревью набора.",
  "author": { "name": "Dex Team", "email": "admin@dex.ru" },
  "keywords": ["skill", "requirements", "requirement-set", "completeness", "traceability", "consistency", "scope", "requirement-defect"],
  "repository": "https://github.com/dex-it/claude-code-marketplace",
  "license": "GPL-3.0"
}
```

- [ ] **Step 2: Создать SKILL.md** — trap-skill, формат «Неправильно / Правильно / Почему», 3-5 строк на ловушку. 5 характеристик набора как ловушки. Граница с single-оракулом явная. Черновик:

```markdown
---
name: requirement-set-quality
description: "Дефекты НАБОРА требований как целого (ISO 29148 набор), не единицы: неполнота против источника, забытый класс, противоречие внутри набора, дубли, разъехавшийся scope, невалидируемость набора. Для оркестратора/дирижёра на гейтах и ревью набора. Единицу требования судит requirement-quality. Активируется при набор требований, полнота требований, трассировка FR, scope требований, непротиворечивость набора, requirement set, traceability, забытое требование, дыра в наборе"
---

# Requirement Set Quality

Набор требований ошибается как целое, даже когда каждая единица корректна: источник покрыт не весь, два требования конфликтуют, scope разъехался. Единицу судит `requirement-quality` (одно требование + код); здесь - свойства МНОЖЕСТВА против источника (BRD/цели/запрос). Нужен весь набор + источник - потому грузит оркестратор/дирижёр, видящий набор целиком, не составитель-субагент (видит свой артефакт).

## Неполнота набора (Complete)

### Набор не покрывает все нужды источника
Неправильно: часть целей/акторов/сценариев источника не отражена ни одним требованием; набор принят как полный, потому что каждое имеющееся требование корректно.
Правильно: сверить набор с источником по каждой нужде - цель/актор/сценарий без покрывающего требования - дыра набора; помечается и адресуется, а не закрывается тем, что единицы валидны.
Почему: полнота единицы (все для её понимания) не равна полноте набора (все нужды покрыты); забытый класс требований всплывает как «не реализовано» на нижнем узле, который набору доверился.

### Осиротевшее требование без нужды источника
Неправильно: в наборе есть требование, не возводимое ни к одной бизнес-цели/нужде источника; принято, потому что технически корректно.
Правильно: каждое требование трассируется к нужде источника; требование без источника - либо забытая нужда (дописать в источник), либо лишнее (убрать), но не молча оставлено.
Почему: требование без нужды - либо scope creep, либо потерянная связь; и то и другое искажает набор как модель источника.

## Противоречивость набора (Consistent)

### Два требования набора конфликтуют или дублируют
Неправильно: набор содержит взаимоисключающие требования либо два требования об одном под разными именами; конфликт не виден при чтении единиц по отдельности.
Правильно: набор проверяется на попарную совместимость и единство термина на понятие; конфликт - `requirement-defect` с цитатой обоих; дубль - слить или развести явным условием.
Почему: конфликт внутри набора реализуется как выбор стороны в коде молча (см. `requirement-quality` «Противоречие», но там пара; здесь - свойство всего набора); дубль плодит рассинхрон при правке одной копии.

## Разъехавшийся scope (Bounded)

### Набор вышел за границы нужд источника
Неправильно: набор оброс требованиями сверх нужд источника (додуманные фичи, «раз уж делаем»); границы scope не сверены с источником.
Правильно: набор held within границ источника; требование сверх нужд - в non-goal с основанием либо назад к источнику на подтверждение, не молча в набор.
Почему: разросшийся набор удорожает реализацию и размывает критерий «готово»; scope creep на уровне набора не ловится проверкой единицы.

## Невыполнимость/невалидируемость набора (Affordable, Able to be Validated)

### Набор невыполним в рамках цикла или неверифицируем целиком
Неправильно: набор в целом не укладывается в бюджет/сроки/технику/legal ограничения цикла, либо нет способа провалидировать, что набор ведёт к целям источника; оценивается по единицам, не целиком.
Правильно: набор проверить на совокупную выполнимость (сумма, не отдельные единицы) и на наличие способа валидации против целей; неподъёмный/неверифицируемый набор - `requirement-defect` наверх с конкретным ограничением.
Почему: единица выполнима, сумма - нет (совокупная стоимость/связанность); набор без способа валидации нельзя принять как ведущий к целям, даже если каждая единица проверяема.

> Единицу требования (противоречие пары, неоднозначность, невыполнимость одной) судит `dex-skill-requirement-quality`. Здесь - только свойства набора против источника.
```

- [ ] **Step 3: Прогнать `optimize-for-llm`** на SKILL.md (обобщённость: без имён проектов; границы с single-оракулом не размывать; description <= 750).

- [ ] **Step 4: Добавить запись в `marketplace.json`** (алфавит/секция skills; поля `name, source, description, version, category: skill, keywords`):

```json
{
  "name": "dex-skill-requirement-set-quality",
  "source": "./plugins/skills/dex-skill-requirement-set-quality",
  "description": "...(из plugin.json)...",
  "version": "1.0.0",
  "category": "skill",
  "keywords": ["skill", "requirements", "requirement-set", "completeness", "traceability", "consistency"]
}
```

- [ ] **Step 5: Bump version каталога** — новый плагин = minor каталога (`marketplace.json` верхнеуровневое `version`).

- [ ] **Step 6: Валидировать**

Run: `npm run validate:skills && npm run validate`
Expected: 0 ошибок. Skill в диапазоне 80-250 строк, description <= 750.

---

## Фаза C: rename adr-authoring -> adr-quality

Rename skill (major bump 1.0.0 -> 2.0.0). 10 точек ссылок (по разведке, с номерами строк). Все в одном PR — иначе битые ссылки.

### Task C1: Rename директории и файлов skill

**Files:**
- Move: `plugins/skills/dex-skill-adr-authoring/` -> `plugins/skills/dex-skill-adr-quality/`
- Move: `.../skills/adr-authoring/` -> `.../skills/adr-quality/`
- Modify: `plugins/skills/dex-skill-adr-quality/.claude-plugin/plugin.json` (name, version)
- Modify: `plugins/skills/dex-skill-adr-quality/skills/adr-quality/SKILL.md` (frontmatter name)

**Interfaces:**
- Produces: skill-имя `dex-skill-adr-quality:adr-quality` — на него ссылаются adr-writer (C2), реестр node-contract (A3), design-reviewer (G).

- [ ] **Step 1: Переместить директории** (git mv для сохранения истории):

```bash
cd /home/mmx/Work/claude-market/claude-code-marketplace
git mv plugins/skills/dex-skill-adr-authoring plugins/skills/dex-skill-adr-quality
git mv plugins/skills/dex-skill-adr-quality/skills/adr-authoring plugins/skills/dex-skill-adr-quality/skills/adr-quality
```

- [ ] **Step 2: Править plugin.json** — `name: dex-skill-adr-quality`, `version: 2.0.0`. Прочитать текущий, заменить оба поля.

- [ ] **Step 3: Править SKILL.md frontmatter** — `name: adr-quality`. Тело skill (ловушки ADR) не трогать, если не требует ASCII-миграции; тронул файл — привести к ASCII целиком (Global Constraint).

- [ ] **Step 4: Валидировать**

Run: `npm run validate:skills`
Expected: 0 ошибок (директория совпадает с name).

### Task C2: Обновить все ссылки на adr-authoring

**Files (по разведке, путь:строка):**
- Modify: `.claude-plugin/marketplace.json:754-755` (name + source)
- Modify: `plugins/specialists/architecture/dex-adr-writer/agents/adr-writer.md:61,82` (Skill-ссылка + упоминание)
- Modify: `plugins/bundles/dex-bundle-architect/bundle.json:19` (includes[])
- Modify: `plugins/bundles/dex-bundle-architect/README.md:46`
- Modify: `plugins/skills/dex-skill-doc-standards/skills/doc-standards/SKILL.md:81` (сноска)
- Modify: `README.md:197` (каталог)

**Interfaces:**
- Consumes: новое имя `dex-skill-adr-quality` / `adr-quality` (C1).

- [ ] **Step 1: Найти все вхождения** (страховка от пропуска):

Run: `rg -n 'adr-authoring' plugins/ docs/ README.md .claude-plugin/`
Expected: список из ~10 точек; каждую обработать.

- [ ] **Step 2: Заменить `dex-skill-adr-authoring` -> `dex-skill-adr-quality`** и `adr-authoring` -> `adr-quality` (skill-имя внутри `{plugin}:{skill}`). В `marketplace.json:754-755` — и name, и source-путь. В `bundle.json:19` includes — `dex-skill-adr-quality`.

- [ ] **Step 3: Bump bundle** — `dex-bundle-architect` правит includes[] => minor bump (`bundle.json` version + `marketplace.json`).

- [ ] **Step 4: Верифицировать 0 остатков**

Run: `rg -n 'adr-authoring' plugins/ docs/ README.md .claude-plugin/`
Expected: пусто (кроме спеки/плана, где rename описан как история — их не трогаем).

- [ ] **Step 5: Валидировать**

Run: `npm run validate`
Expected: 0 ошибок (bundle замкнут, ссылки резолвятся).

---

## Фаза D: составители — метка quality-checks на выходе

Оба уже грузят `requirement-quality` (BA Phase 3, USW Phase 4), но факт прогона на выход не выносят. Добавить простановку метки в handoff-Output + interactive-ветку режима (спека §11).

### Task D1: business-requirements-analyst — метка на выходе

**Files:**
- Modify: `plugins/specialists/product/dex-business-analyst/agents/business-requirements-analyst.md` (Phase 4 Output handoff, ~line 107; описательные ссылки на трек — line 3,12,29,107,121)
- Modify: `plugins/specialists/product/dex-business-analyst/.claude-plugin/plugin.json` (version 2.0.2 -> minor)
- Modify: `.claude-plugin/marketplace.json:1247` (version)

**Interfaces:**
- Consumes: поле `quality-checks` + правило простановки (A1, A2).
- Produces: BRD-выход с меткой `{artifact: BRD, check: requirement-quality, verdict}` — потребляет дирижёр (E) и user-story-writer.

- [ ] **Step 1: Добавить в Phase 4 Output (handoff)** простановку метки. В существующий handoff-абзац (line 117-аналог) дописать:

Текст-вставка в Output (handoff) после перечня полей: `, quality-checks (запись {artifact: BRD, check: requirement-quality, verdict: passed|failed} - результат прогона requirement-quality в Phase 3; verdict: failed с перечнем дефектов, если blocked)`.

- [ ] **Step 2: Перевести описательные ссылки на трек** (решение оператора — на зоны/команды). В `description` (line 3) и теле (12, 29, 107, 121): «Исполнитель трека "Требования"» -> «Составитель требований зоны 1 (`/feature`)»; «вход трека Согласование/Спецификация» -> «вход зоны 2 (`/design`)». Точные формулировки — сверить контекст каждой строки при правке.

- [ ] **Step 3: Interactive-ветка режима** — если у агента нет раздела mode (BA — Analyst-рецепт, обычно autonomous-узел): добавить, что при `mode: interactive` (от дирижёра/команды) открытые бизнес-вопросы задаются оператору, при `autonomous` — в Output как сейчас. Минимальная правка: одна строка в разделе mode/Boundaries.

- [ ] **Step 4: `optimize-for-llm`** на изменённых кусках + bump minor (2.0.2 -> 2.1.0), два места.

- [ ] **Step 5: Валидировать**

Run: `npm run validate:agents`
Expected: 0 ошибок.

### Task D2: user-story-writer — метка на выходе

**Files:**
- Modify: `plugins/specialists/product/dex-user-story-writer/agents/user-story-writer.md` (Phase 4 Output handoff, line 117)
- Modify: `plugins/specialists/product/dex-user-story-writer/.claude-plugin/plugin.json` (1.3.0 -> minor)
- Modify: `.claude-plugin/marketplace.json:1312` (version)

**Interfaces:**
- Consumes: `quality-checks` + правило (A1, A2).
- Produces: stories-выход с меткой `{artifact: stories, check: requirement-quality, verdict}` — потребляет дирижёр (E), architect (H).

- [ ] **Step 1: Добавить в Phase 4 Output (handoff)** метку. В существующий handoff-абзац (line 117) дописать после перечня полей: `, quality-checks (запись {artifact: stories, check: requirement-quality, verdict} - результат прогона requirement-quality в Phase 4)`.

- [ ] **Step 2: Interactive-ветка** — USW обычно autonomous-узел; если дирижёр зовёт его субагентом, режим остаётся autonomous (дыры -> blocked наверх дирижёру). Проверить: правка нужна только если тело жёстко предполагает один режим. Если mode уже из входа (node-contract) — правка не требуется, зафиксировать статусом «n/a — режим уже из входа».

- [ ] **Step 3: `optimize-for-llm`** + bump minor (1.3.0 -> 1.4.0), два места.

- [ ] **Step 4: Валидировать**

Run: `npm run validate:agents`
Expected: 0 ошибок.

---

## Фаза E: дирижёр requirements-orchestrator + /feature

Новый агент-оркестратор (рецепт Operator) + тонкая команда `/feature`. Дирижёр держит канал к оператору, спавнит составителей, гоняет гейты single+set, собирает апрув.

### Task E1: Создать агент requirements-orchestrator

**Files:**
- Create: `plugins/specialists/product/dex-requirements-orchestrator/.claude-plugin/plugin.json`
- Create: `plugins/specialists/product/dex-requirements-orchestrator/agents/requirements-orchestrator.md`
- Create: `plugins/specialists/product/dex-requirements-orchestrator/README.md`

**Interfaces:**
- Consumes: составители BA/USW (спавн через Agent), оракул `requirement-set-quality` (B), поле `quality-checks` (A).
- Produces: агент-имя `requirements-orchestrator` — зовётся командой `/feature` (E2).

- [ ] **Step 1: Создать агент** по рецепту Operator (AGENT_FRAMEWORK) + канва фаз из спеки §5. Frontmatter:

```yaml
---
name: requirements-orchestrator
description: Дирижёр порождения требований зоны 1 - идея/тема -> BRD -> stories, интерактивные гейты качества (single+set) + апрув аналитика. Режим из входа (`interactive` от /feature; дефолт autonomous узел). Handoff - принимает идею/тему ИЛИ проработанную идею ИЛИ чужой готовый BRD; отдаёт апрувнутый BRD + stories с трассировкой FR->AC + метка quality-checks. Триггеры - конвейер требований, feature pipeline, идея в требования, BRD и stories, гейт требований, requirements orchestration, порождение требований
tools: Read, Write, Grep, Glob, Skill, Agent, ToolSearch, WebSearch, WebFetch
model: opus
skills:
  - dex-skill-node-contract:node-contract
---
```

Фазы (контракты Goal/Output/Gate/Mandatory-обоснование): Bootstrap (классификация входа: сырая тема / проработанная идея / чужой готовый артефакт) -> Стадия 1 Ideate->BRD (conditional, спавн BA, ГЕЙТ BRD: single метка от BA + set-оракул дирижёром -> находки оператору -> explicit approval) -> Стадия 2 Decompose (спавн USW, ГЕЙТ stories: метка + трассировка FR->AC set-оракулом -> оператору -> approval) -> Handoff (апрувнутые stories в зону 2).

Ключевые нормативы (из спеки §5, §7): инвариант режима (interactive диалог/апрув vs autonomous возврат наверх, дефолт autonomous); explicit confirmation на необратимых гейтах; толерантный вход (skip Стадии 1 по проработанности, не размеру); Necessary — советническое мнение только в interactive, не оракул; set-оракул грузит дирижёр (не составитель); доверие метке single полное.

- [ ] **Step 2: plugin.json + README** (README для человека — не гнать через optimize-for-llm).

- [ ] **Step 3: `optimize-for-llm`** на теле агента (фазы = контракты, не процедуры; mandatory с обоснованием; каскад fact-check в tools присутствует — ToolSearch+WebSearch+WebFetch есть).

- [ ] **Step 4: Добавить в marketplace.json** + bump version каталога (новый плагин = minor каталога).

- [ ] **Step 5: Валидировать**

Run: `npm run validate:agents`
Expected: 0 ошибок. Mandatory-фазы обоснованы; tools покрывают фазы (Agent для спавна, Skill для оракулов, каскад fact-check).

### Task E2: Создать команду /feature

**Files:**
- Create: `plugins/specialists/product/dex-requirements-orchestrator/commands/feature.md`

**Interfaces:**
- Consumes: агент `requirements-orchestrator` (E1).

- [ ] **Step 1: Создать команду** (эталон `/design` — явная передача mode). Frontmatter: `description`, `allowed-tools: Read, Write, Grep, Glob, Skill` (БЕЗ `Agent` — конвенция репо), `argument-hint: "[идея / тема / путь к готовому BRD]"`. Тело: `# /feature` + Goal + Input + Output + Constraints + финальная строка:

`Делегировать агенту `requirements-orchestrator` с **`mode: interactive`** во входе (команда исполняется главным циклом - канал к юзеру есть; без явного `interactive` агент уйдёт в autonomous и не будет вести диалог/гейты-апрув).`

Output: апрувнутый BRD (эпик) + stories (FR->AC трассировка + AC) + status: approved + метка quality-checks + handoff в /design. НЕ спека/задачи/код.

- [ ] **Step 2: `optimize-for-llm`** (команда 20-50 строк, Goal+Output, не workflow).

- [ ] **Step 3: Валидировать**

Run: `npm run validate:commands`
Expected: 0 ошибок. `Agent` НЕ в allowed-tools.

---

## Фаза F: requirements-reviewer + /review-requirements

Новый агент-ревьюер (рецепт Reviewer, без Write) + команда. Судит чужие готовые требования, не порождает. Оракулы переиспользуются (`requirement-quality` + `requirement-set-quality`).

### Task F1: Создать агент requirements-reviewer

**Files:**
- Create: `plugins/specialists/review/dex-requirements-reviewer/.claude-plugin/plugin.json`
- Create: `plugins/specialists/review/dex-requirements-reviewer/agents/requirements-reviewer.md`
- Create: `plugins/specialists/review/dex-requirements-reviewer/README.md`

**Interfaces:**
- Consumes: оракулы `requirement-quality`, `requirement-set-quality` (B); `quality-checks` вход (A).
- Produces: агент-имя `requirements-reviewer` — зовётся `/review-requirements` (F2).

- [ ] **Step 1: Создать агент** по рецепту Reviewer (AGENT_FRAMEWORK строки 652-675), адаптированному под артефакт-документ (не код-diff). Frontmatter:

```yaml
---
name: requirements-reviewer
description: Ревью/согласование чужого готового набора требований (BRD/stories), не порождение. Дефекты единицы (requirement-quality) + набора (requirement-set-quality), фальсификация, severity. Режим из входа (`interactive` от /review-requirements; дефолт autonomous узел). Handoff - принимает путь к документу требований + опц. источник; отдаёт находки + verdict; правки предлагает автору, сам не вписывает. Триггеры - ревью требований, согласовать чужой BRD, проверить требования, review requirements, приёмка требований, чужие требования, requirement review
tools: Read, Grep, Glob, Skill, ToolSearch, WebSearch, WebFetch
model: opus
skills:
  - dex-skill-node-contract:node-contract
---
```

Фазы (адаптация Reviewer): Context (Phase 0: вход - путь к документу + источник; проверить метку quality-checks на входе - есть passed -> ревью подтверждающее, нет -> полный прогон) -> Domain Priming -> Direct Analysis (single-оракул по единицам) -> Set Analysis (requirement-set-quality по набору - замена Skill-Based Deep Scan, т.к. предмет документ, не стек) -> Fact Verification (mandatory, каскад) -> Cross-Linking -> Severity Calibration -> Output Labeling -> Report (verdict + находки; правки автору - канал доставки решает оператор в interactive: задача ИЛИ документ).

Нормативы: mode дефолт autonomous, interactive от команды; без Write — чужой документ не мутирует; ответ второй стороны = claim (verify по документу до снятия); доставка правок по месту (задача/документ), оператор решает.

- [ ] **Step 2: plugin.json + README.**

- [ ] **Step 3: `optimize-for-llm`** на теле (каскад fact-check в tools есть: ToolSearch+WebSearch+WebFetch; Write отсутствует намеренно).

- [ ] **Step 4: marketplace.json** + bump version каталога (новый плагин).

- [ ] **Step 5: Валидировать**

Run: `npm run validate:agents`
Expected: 0 ошибок.

### Task F2: Создать команду /review-requirements

**Files:**
- Create: `plugins/specialists/review/dex-requirements-reviewer/commands/review-requirements.md`

- [ ] **Step 1: Создать команду** (эталон `/mr-review` + явная mode из `/design`). Frontmatter: `description`, `allowed-tools: Read, Grep, Glob, Skill`, `argument-hint: "<путь к BRD/stories> [источник/BRD для трассировки]"`. Тело: Goal + Input + Output + Constraints + `Делегировать агенту `requirements-reviewer` с **`mode: interactive`** во входе`.

Constraints: без записи в документ автора (нет Write); находки -> оператору -> правки автору; канал доставки (задача/документ) решается в диалоге.

- [ ] **Step 2: `optimize-for-llm`.**

- [ ] **Step 3: Валидировать**

Run: `npm run validate:commands`
Expected: 0 ошибок.

---

## Фаза G: design-reviewer + /review-design

Симметрично F, но предмет — дизайн-документ (спека/ADR/диаграммы). Оракулы: `nfr`, `requirement-quality`, `adr-quality`, `cap-consistency`/`clean-architecture`/`ddd` (по стилю).

### Task G1: Создать агент design-reviewer

**Files:**
- Create: `plugins/specialists/architecture/dex-design-reviewer/.claude-plugin/plugin.json`
- Create: `plugins/specialists/architecture/dex-design-reviewer/agents/design-reviewer.md`
- Create: `plugins/specialists/architecture/dex-design-reviewer/README.md`

**Interfaces:**
- Consumes: оракулы `nfr`, `requirement-quality`, `adr-quality` (C), `cap-consistency`, `clean-architecture`, `ddd`; `quality-checks` вход (A).
- Produces: агент-имя `design-reviewer` — зовётся `/review-design` (G2).

- [ ] **Step 1: Создать агент** по рецепту Reviewer, адаптация под дизайн-документ. Frontmatter:

```yaml
---
name: design-reviewer
description: Ревью/согласование чужого дизайн-документа (спека/ADR/диаграммы) до кода, не архитектура реализованного кода (то - /review-arch). Оракулы nfr/requirement-quality/adr-quality/арх-скиллы, фальсификация, severity. Режим из входа (`interactive` от /review-design; дефолт autonomous узел). Handoff - принимает путь к дизайн-документу; отдаёт находки + verdict; правки предлагает автору, сам не вписывает. Триггеры - ревью дизайна, согласовать чужой дизайн, проверить спеку, design review, ревью ADR, architecture document review, приёмка дизайна
tools: Read, Grep, Glob, Skill, ToolSearch, WebSearch, WebFetch
model: opus
skills:
  - dex-skill-node-contract:node-contract
---
```

Фазы (Reviewer, адаптация под дизайн-документ): Context (Phase 0: путь к документу; метка quality-checks на входе) -> Domain Priming -> Skill-Based Deep Scan (грузит оракулы по аспектам: nfr для NFR-полноты, requirement-quality для противоречий/конфликта с ADR, adr-quality для ADR-решений, cap-consistency/clean-architecture/ddd по стилю) -> Fact Verification (mandatory, каскад) -> Cross-Linking -> Severity Calibration -> Output Labeling -> Report (verdict + находки; правки автору по месту).

Нормативы: предмет — дизайн-документ ДО кода (граница с /review-arch явная в Boundaries); без Write; ответ второй стороны = claim; доставка правок по месту.

- [ ] **Step 2: plugin.json + README.**

- [ ] **Step 3: `optimize-for-llm`** (каскад fact-check есть; Boundaries чётко отделяет от /review-arch).

- [ ] **Step 4: marketplace.json** + bump version каталога.

- [ ] **Step 5: Валидировать**

Run: `npm run validate:agents`
Expected: 0 ошибок.

### Task G2: Создать команду /review-design

**Files:**
- Create: `plugins/specialists/architecture/dex-design-reviewer/commands/review-design.md`

- [ ] **Step 1: Создать команду.** Frontmatter: `description`, `allowed-tools: Read, Grep, Glob, Skill`, `argument-hint: "<путь к дизайн-документу (спека/ADR)>"`. Тело: Goal + Input + Output + Constraints + `Делегировать агенту `design-reviewer` с **`mode: interactive`** во входе`.

Constraint: НЕ дубль `/review-arch` (тот — архитектура кода; этот — дизайн-документ до кода).

- [ ] **Step 2: `optimize-for-llm`.**

- [ ] **Step 3: Валидировать**

Run: `npm run validate:commands`
Expected: 0 ошибок.

---

## Фаза H: architect + /design — доработка входа

`/design` -> architect уже замыкает контур (interactive + Phase 5 апрув). Доработка: принять stories как явный вход + input-acceptance метки quality-checks.

### Task H1: architect — принять stories + input-acceptance метки

**Files:**
- Modify: `plugins/specialists/architecture/dex-architect/agents/architect.md` (Phase 0/1 вход + Input handoff)
- Modify: `plugins/specialists/architecture/dex-architect/commands/design.md` (Input)
- Modify: `plugins/specialists/architecture/dex-architect/.claude-plugin/plugin.json` (version minor)
- Modify: `.claude-plugin/marketplace.json:1150-аналог` (version)

**Interfaces:**
- Consumes: stories с меткой quality-checks от user-story-writer (D2) / зоны 1; правило входной приёмки (A3).

- [ ] **Step 1: Добавить в Input агента** приём stories. Сейчас вход — «бизнес-задача в свободной форме»; дописать: валидный вход также — апрувнутые stories из зоны 1 (эпик). В Phase 0/1 (Understand Requirements) — если пришли stories, использовать как R-требования.

- [ ] **Step 2: Input-acceptance метки** (по node-contract A3, п.8). В Input handoff-абзац: архитектор смотрит `quality-checks` по типу stories — метка `{stories, requirement-quality, passed}` есть -> требования не перепроверять; нет -> прогнать `requirement-quality`/`requirement-set-quality` сам, дефект -> возврат в зону 1 (не дочинять — зона аналитика).

- [ ] **Step 3: Обновить `/design` Input** — упомянуть, что валидный вход включает апрувнутые stories (эпик), не только свободную задачу.

- [ ] **Step 4: `optimize-for-llm`** на изменённых кусках + bump minor, два места.

- [ ] **Step 5: Валидировать**

Run: `npm run validate:agents && npm run validate:commands`
Expected: 0 ошибок.

---

## Фаза I: движок autonomous-task — удаление 3 треков + чистка ссылок

Последняя фаза: удаляет то, что переехало в E/H. Удалить треки Требования, Согласование/Спецификация, Проектирование + их файлы + все ссылки (по разведке — с номерами строк).

### Task I1: Удалить файлы треков и строки таблицы SKILL.md

**Files:**
- Delete: `plugins/ai-sdlc/dex-skill-autonomous-task/skills/autonomous-task/tracks/requirements.md`
- Delete: `.../tracks/specification.md`
- Delete: `.../tracks/design.md`
- Modify: `.../autonomous-task/SKILL.md` (таблица треков 184-186; карта трек->файл 96-97; frontmatter description 4-5, 8-9)

**Interfaces:**
- Consumes: факт переезда треков в зоны 1-2 (E, H готовы).

- [ ] **Step 1: Удалить три файла треков**

```bash
cd /home/mmx/Work/claude-market/claude-code-marketplace
git rm plugins/ai-sdlc/dex-skill-autonomous-task/skills/autonomous-task/tracks/requirements.md \
       plugins/ai-sdlc/dex-skill-autonomous-task/skills/autonomous-task/tracks/specification.md \
       plugins/ai-sdlc/dex-skill-autonomous-task/skills/autonomous-task/tracks/design.md
```

- [ ] **Step 2: Удалить строки 184-186 таблицы треков** в SKILL.md (Требования, Согласование/Спецификация, Проектирование). Оставить 187-193.

- [ ] **Step 3: Переписать карту трек->файл (строки 96-97)** — убрать `Требования -> requirements.md; Согласование/Спецификация -> specification.md; Проектирование -> design.md`, оставить перечисление с Разработки.

- [ ] **Step 4: Править frontmatter description (4-5, 8-9)** — убрать «требования, спецификация, проектирование» из перечня целей и активаторы «собери требования, BRD, спроектируй» (эти workflow ушли в зоны). Заменить на актуальный перечень оставшихся треков.

- [ ] **Step 5: Валидировать**

Run: `npm run validate:skills`
Expected: 0 ошибок.

### Task I2: Починить висячие ссылки на удалённые треки

**Files (по разведке):**
- Modify: `.../autonomous-task/tracks/stand-acceptance.md:28-29` (ссылка на requirements.md)
- Modify: `.claude-plugin/marketplace.json:1993` (description движка)
- Modify: `plugins/ai-sdlc/dex-skill-autonomous-task/.claude-plugin/plugin.json` (version 1.5.0 -> major)

**Interfaces:**
- Consumes: удаление треков (I1).

- [ ] **Step 1: Править stand-acceptance.md:28-29** — «если пришли из BRD - `requirements.md`» -> ссылка на зону 1 (`/feature`) как источник BRD, не на удалённый файл.

- [ ] **Step 2: Править marketplace.json:1993 description** движка — убрать «требования/спецификация/проектирование» из перечня треков.

- [ ] **Step 3: Bump движок major** (1.5.0 -> 2.0.0 — breaking: контракт треков изменён), два места.

- [ ] **Step 4: Верифицировать 0 висячих ссылок**

Run: `rg -n 'requirements\.md|specification\.md|tracks/design\.md' plugins/ai-sdlc/`
Expected: пусто (кроме самих оставшихся треков, если ссылаются друг на друга легитимно — проверить контекст).

- [ ] **Step 5: Валидировать**

Run: `npm run validate:skills`
Expected: 0 ошибок.

### Task I3: Обновить DEV_PROCESS_COVERAGE + агенты-исполнители

**Files (по разведке):**
- Modify: `docs/DEV_PROCESS_COVERAGE.md:19,20,28,45,48-49,56,60,71` (карта трек->исполнитель)
- Modify: `plugins/specialists/product/dex-requirements-analyst/agents/requirements-analyst.md:85`
- Modify: `plugins/specialists/delivery/dex-feature-implementer/agents/feature-implementer.md:44,47`

(business-requirements-analyst и user-story-writer уже правлены в D1/D2.)

**Interfaces:**
- Consumes: новая карта зон (E, F, G, H).

- [ ] **Step 1: DEV_PROCESS_COVERAGE.md** — строки 19/20/28 (Требования/Спецификация/Проектирование -> исполнитель) переписать под зоны: слот «Требования» -> зона 1 (`/feature` + `/review-requirements`); «Спецификация/Проектирование» -> зона 2 (`/design` + `/review-design`). Пояснения 45/48-49/56/60/71 синхронизировать. Это doc для человека — НЕ гнать через optimize-for-llm, но ASCII-пунктуация обязательна (тронул файл).

- [ ] **Step 2: requirements-analyst.md:85** — «разграничение с трек-Требования» переформулировать (трека нет; разграничение с зоной 1 или убрать, если потеряло смысл).

- [ ] **Step 3: feature-implementer.md:44,47** — «BRD трека Требования» как источник R -> «BRD зоны 1» (источник R не меняется, меняется имя дома).

- [ ] **Step 4: Bump затронутых агентов** (requirements-analyst, feature-implementer) — patch (ссылка/формулировка), два места каждому.

- [ ] **Step 5: Верифицировать 0 упоминаний удалённых треков**

Run: `rg -n 'трек.{0,3}Требовани|Согласование/Спецификаци|трек.{0,3}Проектирован' plugins/ docs/DEV_PROCESS_COVERAGE.md`
Expected: пусто (кроме спеки/плана — история).

- [ ] **Step 6: Валидировать**

Run: `npm run validate:agents`
Expected: 0 ошибок.

---

## Фаза J: синхронизация каталога + финальная проверка

### Task J1: Каталог CLAUDE.md + README + version каталога

**Files:**
- Modify: `CLAUDE.md` (правило конвенции `-quality`; описание зон/команд если каталог там)
- Modify: `README.md` (каталог плагинов — новые 3 specialist + 1 skill; уровни)
- Modify: `.claude-plugin/marketplace.json` (верхнеуровневый `version` — суммарный bump за новые плагины)

- [ ] **Step 1: CLAUDE.md — правило конвенции оракулов.** В раздел «Именование» добавить: skill-оракул проверки артефакта = `{тип-артефакта}-quality`, нейтрально к направлению (оракул двусторонний). Строка-суть + без дублирования (нормативный дом — CLAUDE.md).

  После добавления правила — вернуть ссылку на него в реестр оракулов `node-contract` (подраздел «Реестр "тип артефакта -> оракул"», строка про конвенцию имени). В Фазе A ссылка НЕ проставлена намеренно: правила ещё не существовало, ссылка была бы висячей.

- [ ] **Step 2: README.md каталог** — добавить 3 новых specialist (`dex-requirements-orchestrator`, `dex-requirements-reviewer`, `dex-design-reviewer`) + 1 skill (`dex-skill-requirement-set-quality`) в обзор уровней. adr-authoring -> adr-quality в списке (уже в C2, проверить).

- [ ] **Step 3: version каталога** — убедиться, что верхнеуровневый `marketplace.json version` поднят суммарно за все новые плагины (4 новых: 3 specialist + 1 skill => minor каталога, хотя бы раз; проверить, что не забыт в E1/F1/G1/B1).

- [ ] **Step 4: ASCII-пунктуация** в тронутых CLAUDE.md/README (единица миграции — файл).

### Task J2: Документ роли оператора (docs/OPERATOR_ROLE.md)

Дом факта «в какой точке цикла человек нужен, в какой нет, и почему». Сейчас грань размазана: `mode` в каждом агенте, «канал к юзеру только у главного цикла» в CLAUDE.md, гейты-апрув в командах. Документ сводит карту; нормативный текст про режим НЕ копирует.

**Files:**
- Create: `docs/OPERATOR_ROLE.md`
- Modify: `CLAUDE.md` (строка-суть + ссылка)
- Modify: `README.md` (ссылка в перечне docs)

**Interfaces:**
- Consumes: зоны и команды (E, F, G, H), удаление треков (I), инвариант режима `node-contract` D п.8.

- [ ] **Step 1: Написать документ.** Читает человек (какую команду звать, где меня спросят) - НЕ гнать через `optimize-for-llm`, но ASCII-пунктуация обязательна. Структура:

1. **Зачем** - грань «интерактив / автоном» определяет, где цикл останавливается и ждёт человека; без карты оператор не знает, вернётся ли к нему решение или будет додумано.
2. **Карта зон** (таблица - операционная суть):

| Зона | Команда | Режим | Что решает оператор | Что решается без него |
|---|---|---|---|---|
| 1. Требования - создание | `/feature` | interactive | scope эпика, приоритет, апрув BRD и stories на гейтах | форма требований, трассировка FR->AC, прогон оракулов |
| 1. Требования - согласование | `/review-requirements` | interactive | принять/отклонить находку, канал доставки правок автору | классификация дефектов по оракулам, severity |
| 2. Дизайн - создание | `/design` | interactive | выбор альтернативы, trade-off, апрув дизайна | расчёты, deep-dive, сверка с ADR/инвариантами |
| 2. Дизайн - согласование | `/review-design` | interactive | принять/отклонить находку, канал доставки правок | прогон nfr/adr-quality/арх-оракулов, severity |
| 3. Движок от задачи | `autonomous-task` | autonomous | постановка задачи на входе, приёмка результата | всё внутри трека: реализация, тесты, ревью, диагностика |

3. **Почему граница на задаче** - до задачи решения необратимы и требуют бизнес-суждения (scope, приоритет, trade-off), додумать их нельзя; после задачи работа автономно-доводима. Трек, требующий согласования, в движок не берётся.
4. **Механика режима** - ссылка на `dex-skill-node-contract` (инвариант D п.8), НЕ копия. Процитировать дословно одно: **режим меняет только адресата возврата, НЕ право пропустить бизнес-решение**. Плюс: канал к юзеру только у главного цикла; спавн субагента = канала нет -> дефолт `autonomous`; `interactive` включается явной передачей от команды-обёртки.
5. **Что происходит с вопросом в автономном контуре** - не «решить за оператора»: либо явное допущение с пометкой, либо `status: blocked` наверх. Бизнес-решение автономный узел не принимает молча ни в каком режиме.
6. **Как оператору выбрать точку входа** - есть идея -> `/feature`; чужие требования на приёмку -> `/review-requirements`; есть требования, нужен дизайн -> `/design`; чужой дизайн на приёмку -> `/review-design`; есть задача -> движок.

- [ ] **Step 2: Строка-суть в CLAUDE.md** - в раздел про композицию/процесс: «Грань интерактив/автоном по зонам цикла - [docs/OPERATOR_ROLE.md](docs/OPERATOR_ROLE.md); нормативный текст про `mode` - `dex-skill-node-contract`». Ссылка, не пересказ (один факт - один дом).

- [ ] **Step 3: Кросс-сверка дублей** - после написания `rg` по терминам, чтобы документ не разошёлся с существующими домами:

```bash
rg -n 'канал к юзеру|interactive|autonomous' CLAUDE.md docs/AGENT_FRAMEWORK.md docs/DEV_PROCESS_COVERAGE.md
```
Expected: найденные места либо синхронны документу, либо сведены к ссылке на него. Расхождение формулировок - дефект, чинить.

- [ ] **Step 4: Ссылка в README.md** - в перечень docs рядом с DEV_PROCESS_COVERAGE.

### Task J3: Финальная сквозная проверка

- [ ] **Step 1: Полный валидатор**

Run: `npm run validate`
Expected: 0 ошибок по agents/skills/commands/bundles.

- [ ] **Step 2: Замкнутость bundle** — если новые оракулы/агенты вошли в какой-либо bundle, bundle замкнут по ним (`npm run validate:bundles`, правило bundle-not-closed). Новые ревьюеры в bundle не входят по умолчанию — проверить, что не сломали существующие.

- [ ] **Step 3: 0 висячих ссылок** — сводный прогон:

```bash
rg -n 'adr-authoring' plugins/ README.md .claude-plugin/
rg -n 'requirements\.md|specification\.md|tracks/design\.md' plugins/ai-sdlc/
rg -n 'трек.{0,3}Требовани|Согласование/Спецификаци|трек.{0,3}Проектирован' plugins/ docs/DEV_PROCESS_COVERAGE.md
```
Expected: все три пусты (кроме спеки/плана — история).

- [ ] **Step 4: Синхрон версий** — plugin.json == marketplace.json для каждого тронутого плагина:

```bash
# для каждого тронутого плагина сверить version в двух местах
```

- [ ] **Step 5: Каталог актуализирован** — README/CLAUDE.md отражают новые артефакты (ручная сверка по чек-листу CLAUDE.md «после изменения списка skills/агентов пересмотреть каталог»).

---

## Self-Review чек-лист (заполнить после написания плана)

- [ ] Роль оператора (запрос вне спеки, решение оператора «в текущий PR») -> J2; нормативка про `mode` не дублируется, только ссылка на node-contract.
- [ ] Каждая секция спеки (§1-13) имеет задачу: §2-5 -> E; §6 -> F; §7 -> H; §8 -> G; §9 ISO -> B (характеристики набора); §10 конвенция -> C+J1; §11 rename -> C; §12 node-contract -> A; §13 состав PR -> все фазы; §14 границы -> не реализуется (границы).
- [ ] Плейсхолдеров нет (все skill/agent-черновики — с реальным содержимым, не «TODO»).
- [ ] Типы/имена консистентны: `quality-checks {artifact, check, verdict}` одинаково во всех задачах; имена агентов совпадают с директориями и frontmatter name.
