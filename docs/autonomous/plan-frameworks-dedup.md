# План: дедупликация фреймворков, фикс рассинхронов, правила самоконтроля docs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Убрать из AGENT_FRAMEWORK впитанное содержимое Reviewer-агента (нормативный дом — сам агент), починить три фактических рассинхрона между документами, срезать устаревшее и зафиксировать в CLAUDE.md правила самоконтроля при правках фреймворков/документации.

**Architecture:** Только правки markdown в `docs/` и `CLAUDE.md` — ни один файл в `plugins/` не трогается, semver-бампы не нужны. Принцип: один факт — один нормативный дом; фреймворк даёт контракт + ссылку на референс-артефакт; CLAUDE.md держит строку-суть + ссылку.

**Tech Stack:** markdown, `npm run validate` (регрессия валидаторов), `rg` (проверка остатков).

**Контекст для исполнителя без истории.** Найденные проблемы:
1. «Библиотека типовых фаз» в AGENT_FRAMEWORK содержит полные спецификации Reviewer-фаз (таблица эмодзи-меток, маркеры tech debt, готовые формулировки) — это копия содержимого агента `mr-reviewer`, копии уже разошлись (Content-Level Pass: в библиотеке `optional`, в рецепте «обычно mandatory»).
2. Лимит «≤ 250 символов» на description агента: валидатор не проверяет, собственные агенты нарушают (debugger 314, mr-reviewer 385), утверждение «keywords обрезаются» не подтверждено документацией.
3. `AGENT_FRAMEWORK.md:945` «валидатор в мягком режиме» противоречит CLAUDE.md «все проверки строгие»; «39 агентов» устарело (сейчас 52).
4. `CLAUDE.md:754` «command → agent — считать, что нет» противоречит `COMMAND_FRAMEWORK.md:157` («команда может вызвать агента») и практике (ревью PR#51: конвенция команда-делегат).
5. Дубли между документами: рецепт Reviewer в 3 местах, by-stack loading в 4 местах.

---

### Task 1: AGENT_FRAMEWORK — срезать раздутые Reviewer-фазы в библиотеке

**Files:**
- Modify: `docs/AGENT_FRAMEWORK.md` (разделы `### Content-Level Pass`, `### Severity Calibration`, `### Tech Debt Classification`, `### Systemic vs Specific Triage`, `### Output Labeling` внутри «Библиотека типовых фаз», строки ~524-585)

Фазы Domain Priming, Non-Code Artifacts Audit, Cross-Linking **не трогать** — они контрактной плотности, без таблиц и шаблонов формулировок.

- [ ] **Step 1: Проверить, что референс-контент существует в mr-reviewer**

Run: `rg -n "маркеры принятого долга|🟢|silent-tech-debt" plugins/specialists/review/dex-mr-reviewer/agents/mr-reviewer.md`
Expected: строки с перечнем маркеров (TODO с тикетом, ADR, `[Obsolete]`), шкалой 🟢🟡🟠🔴🟣 и категориями tech debt. Если их нет — STOP, ссылаться не на что, эскалировать.

- [ ] **Step 2: Выровнять mandatory у Content-Level Pass**

В разделе `### Content-Level Pass` заменить строку:

```markdown
**Typical mandatory:** optional — добавляется, когда structure-level проверки уже прошли и нужна более глубокая оценка.
```

на:

```markdown
**Typical mandatory:** обычно yes для Reviewer; optional только при узко-формальном ревью (см. рецепт Reviewer).
```

- [ ] **Step 3: Заменить раздел `### Severity Calibration` целиком**

Старый раздел (8 строк атрибутов с перечислением stage/audience/sensitivity/compliance и развёрнутым Fallback) заменить на:

```markdown
### Severity Calibration

**Goal:** Подстроить severity и формулировку каждой находки под фактический контекст проекта (stage, audience, чувствительность данных, compliance) — одна и та же находка имеет разную severity в разных контекстах.
**Output:** Каждая находка с калиброванной severity + minimum fix и ideal fix. Калибровка меняет уровень и формулировку, **не вычёркивает** находку.
**Typical position:** после всех scan-фаз и Cross-Linking.
**Typical mandatory:** yes для Reviewer — без калибровки отчёт либо ложно паникует, либо ложно расслабляет.
**Fallback:** контекст неизвестен → explicit assumption с пометкой в отчёте.
```

- [ ] **Step 4: Заменить раздел `### Tech Debt Classification` целиком**

Старый раздел (с перечнем маркеров accepted tech debt и шаблоном формулировки) заменить на:

```markdown
### Tech Debt Classification

**Goal:** Для каждой находки-отклонения определить статус `documented-tech-debt` / `silent-tech-debt` / `error` — от статуса зависит рекомендация (TODO+тикет / тикет в backlog / фикс сейчас).
**Output:** Категория + обоснование (какие маркеры accepted tech debt найдены или не найдены). Дефолт — подсвечивать: без явных маркеров находка идёт в `silent-tech-debt` / `error`, не в «возможно так задумано».
**Typical position:** после Severity Calibration.
**Typical mandatory:** yes для Reviewer.

Полный перечень маркеров и формулировки — в референс-агенте mr-reviewer (см. рецепт Reviewer).
```

- [ ] **Step 5: Заменить раздел `### Systemic vs Specific Triage` целиком**

Старый раздел (с red flags и шаблоном формулировки) заменить на:

```markdown
### Systemic vs Specific Triage

**Goal:** Отделить находки конкретного MR от системных проблем команды/проекта — системную проблему бесполезно подавать как блокер MR, она не закроется.
**Output:** Каждая находка с меткой `mr-specific` / `systemic`; для systemic — рекомендация уровня процесса (DoD, CI-gate, ADR), не блокер MR.
**Typical position:** после Tech Debt Classification.
**Typical mandatory:** обычно yes для Reviewer; optional, если контекст прошлых MR недоступен (см. рецепт Reviewer).
```

- [ ] **Step 6: Заменить раздел `### Output Labeling` целиком**

Старый раздел (с таблицей меток и таблицей соответствия категориям) заменить на:

```markdown
### Output Labeling

**Goal:** Каждой находке присвоить явную метку действия — без неё отчёт превращается в плоский список, по которому непонятно как принимать решение о мёрдже.
**Output:** Каждая находка с меткой по шкале усиления риска 🟢 accepted → 🟡 TODO in code → 🟠 follow-up ticket → 🔴 block merge; 🟣 needs discussion — вне шкалы, запрос решения. 🟢 ставится только при явных маркерах accepted tech debt, иначе минимум 🟡.
**Typical position:** последняя фаза перед Report.
**Typical mandatory:** yes для Reviewer.

Полные правила присвоения и соответствие категориям Tech Debt Classification — в референс-агенте mr-reviewer (см. рецепт Reviewer).
```

- [ ] **Step 7: Проверить**

Run: `rg -n "Соответствие меток|Маркеры accepted tech debt|Red flags systemic" docs/AGENT_FRAMEWORK.md`
Expected: пусто (таблицы и перечни срезаны).
Run: `rg -c "Typical mandatory" docs/AGENT_FRAMEWORK.md`
Expected: число строк не уменьшилось до нуля — атрибуты на месте.

- [ ] **Step 8: Commit**

```bash
git add docs/AGENT_FRAMEWORK.md
git commit -m "docs(agent-framework): срезать Reviewer-фазы библиотеки до контрактов, детали — в референс-агенте"
```

---

### Task 2: AGENT_FRAMEWORK — референс-ссылка в рецепте Reviewer

**Files:**
- Modify: `docs/AGENT_FRAMEWORK.md` (раздел `### Reviewer` внутри «Рецепты для типовых ролей», строки ~723-745)

- [ ] **Step 1: Добавить абзац-референс**

После абзаца «**Mandatory-фазы:** …» (заканчивается «…или контекст последних MR недоступен.») вставить:

```markdown
**Референс реализации рецепта** — `plugins/specialists/review/dex-mr-reviewer/agents/mr-reviewer.md`: полные контракты фаз, шкала меток, маркеры tech debt. Родственные реализации: `self-reviewer` (свой код до push), `mr-check-reviewer` (дельта раунда), `discover-reviewer` (breadth-first аудит). Фреймворк держит состав и обоснование рецепта; полные правила фаз живут в агентах — не дублировать их сюда (копии расходятся, см. анти-паттерн «Дублирование содержимого skill в агенте» — для фреймворка он действует так же).
```

- [ ] **Step 2: Проверить**

Run: `rg -n "Референс реализации рецепта" docs/AGENT_FRAMEWORK.md`
Expected: 1 совпадение в разделе Reviewer.

- [ ] **Step 3: Commit**

```bash
git add docs/AGENT_FRAMEWORK.md
git commit -m "docs(agent-framework): референс-ссылка рецепта Reviewer на mr-reviewer"
```

---

### Task 3: AGENT_FRAMEWORK — убрать непроверенный лимит 250 символов

**Files:**
- Modify: `docs/AGENT_FRAMEWORK.md` (раздел `### Лимиты`, строки ~336-340; self-check строка ~925)

- [ ] **Step 1: Заменить первый пункт раздела `### Лимиты`**

Старый пункт:

```markdown
- ≤ 250 символов (после превышения keywords обрезаются и активация теряет триггеры)
```

Новый:

```markdown
- Платформенный лимит на description агента не задокументирован — не утверждать обрезку. Проектный ориентир: ≤ 500 символов. Description каждого установленного агента попадает в системный промпт сессии целиком: длинный — постоянный налог на контекст, компактный матчится надёжнее
```

- [ ] **Step 2: Поправить self-check строку**

Старая:

```markdown
- [ ] Frontmatter: есть `name`, `description` (роль + области ответственности + триггеры-симптомы, ≤ 250 символов), `tools` (с `Skill`)
```

Новая:

```markdown
- [ ] Frontmatter: есть `name`, `description` (роль + области ответственности + триггеры-симптомы; ≤ 500 символов — проектный ориентир, валидатор не проверяет), `tools` (с `Skill`)
```

- [ ] **Step 3: Проверить**

Run: `rg -n "250 символов" docs/ CLAUDE.md`
Expected: пусто.

- [ ] **Step 4: Commit**

```bash
git add docs/AGENT_FRAMEWORK.md
git commit -m "docs(agent-framework): заменить непроверенный лимит 250 на честный ориентир 500"
```

---

### Task 4: AGENT_FRAMEWORK — глоссарий, «39 агентов», удалить «Что дальше»

**Files:**
- Modify: `docs/AGENT_FRAMEWORK.md` (глоссарий ~25-44; строка ~48; раздел `## Что дальше` ~940-945)

- [ ] **Step 1: Срезать самоочевидные строки глоссария**

Удалить из таблицы глоссария 7 строк — термины, определяемые в своих разделах ниже (дубль): **Goal**, **Output**, **Exit criteria**, **Optional**, **Fallback**, **Композиция фаз**, **Рецепт». Оставить: Агент, Фаза, Gate, Hard gate, Soft gate, Explicit confirmation, Mandatory, Conditional, Skip_if, Императивная загрузка skill, Observable.

- [ ] **Step 2: Убрать хардкод числа агентов**

Старое (строка ~48):

```markdown
Без фреймворка каждый автор агента изобретает структуру заново. Результат — 39 агентов с 39 разными workflow, разной степени проработки, с разным уровнем защиты от типичных failure mode'ов LLM (перескакивание к решению без диагностики, отсутствие проверки результата, размытые границы ответственности).
```

Новое:

```markdown
Без фреймворка каждый автор агента изобретает структуру заново. Результат — десятки агентов, каждый со своим workflow, разной степени проработки, с разным уровнем защиты от типичных failure mode'ов LLM (перескакивание к решению без диагностики, отсутствие проверки результата, размытые границы ответственности).
```

- [ ] **Step 3: Удалить раздел `## Что дальше` целиком**

Удалить от заголовка `## Что дальше` до конца файла (6 строк: audit 39 агентов, rollout, «мягкий режим» — всё устарело/противоречит CLAUDE.md; миграция исполнена, см. DEV_PROCESS_COVERAGE).

- [ ] **Step 4: Проверить**

Run: `rg -n "39 агент|мягком режиме|Что дальше" docs/AGENT_FRAMEWORK.md`
Expected: пусто.
Run: `rg -n "\| \*\*(Goal|Output|Exit criteria|Optional|Fallback)\*\*" docs/AGENT_FRAMEWORK.md`
Expected: пусто (строки глоссария удалены; вхождения `**Goal:**` в телах фаз остаются — это не глоссарий).

- [ ] **Step 5: Commit**

```bash
git add docs/AGENT_FRAMEWORK.md
git commit -m "docs(agent-framework): срезать самоочевидный глоссарий, убрать устаревший хвост миграции"
```

---

### Task 5: CLAUDE.md — рецепт Reviewer ссылкой, починить command → agent

**Files:**
- Modify: `CLAUDE.md` (строка 754 — таблица композиции; раздел `### Обязательные фазы для агентов-ревьюеров (рецепт Reviewer)` со строки 769)

- [ ] **Step 1: Заменить раздел про ревьюеров целиком**

Раздел `### Обязательные фазы для агентов-ревьюеров (рецепт Reviewer)` (11 нумерованных фаз + абзац «Дефолт подсвечивания») заменить на:

```markdown
### Агенты-ревьюеры — рецепт Reviewer

Создаёшь / правишь ревью-агента → workflow по рецепту Reviewer в [AGENT_FRAMEWORK.md](docs/AGENT_FRAMEWORK.md) (состав фаз, mandatory-список, обоснование). Референс реализации — `plugins/specialists/review/dex-mr-reviewer/agents/mr-reviewer.md`. Сюда состав фаз не копировать — нормативный дом один.

**Дефолт подсвечивания**: нет маркеров accepted tech debt (TODO+тикет, ADR, `[Obsolete]`, пометка в CLAUDE.md/MR) → находка подсвечивается, не молча принимается.
```

- [ ] **Step 2: Заменить строку таблицы композиции**

Старая (строка ~754):

```markdown
| command → agent | не задокументировано | считать, что нет |
```

Новая:

```markdown
| command → agent | ✓ на практике | команда-делегат: тело команды поручает работу агенту. `Agent` в `allowed-tools` команде не давать — оркестрация живёт в агенте (конвенция репо, ревью PR#51) |
```

- [ ] **Step 3: Проверить**

Run: `rg -n "Обязательные фазы для агентов-ревьюеров|считать, что нет" CLAUDE.md`
Expected: «Обязательные фазы…» — пусто; «считать, что нет» — осталась ровно 1 строка (skill → agent).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): рецепт Reviewer ссылкой вместо копии; command→agent — работает, конвенция делегата"
```

---

### Task 6: COMMAND_FRAMEWORK — конвенция команда-делегат

**Files:**
- Modify: `docs/COMMAND_FRAMEWORK.md` (раздел `## Связь с агентами и skills`, строка ~157)

- [ ] **Step 1: Расширить первый пункт раздела**

Старый:

```markdown
- **Команда** может **вызвать агента**: `/design` → запускает architect sub-agent
```

Новый:

```markdown
- **Команда** может **вызвать агента** (команда-делегат): `/design` → architect, `/dotnet-quality-audit` → dotnet-quality-auditor. Конвенция репо: `Agent` в `allowed-tools` команде не давать — команда лишь поручает задачу агенту текстом, оркестрация (спавн суб-агентов) живёт в агенте
```

- [ ] **Step 2: Проверить**

Run: `rg -n "команда-делегат" docs/COMMAND_FRAMEWORK.md CLAUDE.md`
Expected: по 1+ совпадению в обоих файлах, формулировки согласованы.

- [ ] **Step 3: Commit**

```bash
git add docs/COMMAND_FRAMEWORK.md
git commit -m "docs(command-framework): конвенция команда-делегат без Agent в allowed-tools"
```

---

### Task 7: DEV_PROCESS_COVERAGE — удалить исполненный статус, сжать by-stack дубль

**Files:**
- Modify: `docs/DEV_PROCESS_COVERAGE.md` (blockquote ~76-87; раздел `## Статус миграции (исполнено)` ~100-116)

- [ ] **Step 1: Сжать blockquote «Принцип загрузки skills общими агентами»**

Заменить 12-строчный blockquote на:

```markdown
> **Принцип загрузки skills общими агентами** — by-stack loading: стек по манифесту →
> фильтр available-skills по префиксу `dex-skill-<стек>-*` через реестр
> `dex-skill-stack-registry`. Новый стек = новые skills + строка реестра; агенты не
> правятся. Полное описание и обоснование — [AGENT_FRAMEWORK.md](AGENT_FRAMEWORK.md),
> раздел «By-stack loading».
```

- [ ] **Step 2: Удалить раздел `## Статус миграции (исполнено)` целиком**

Историческая справка (bug-hunter удалён, security переработан) — место в git history / PR description, через полгода будет вводить в заблуждение.

- [ ] **Step 3: Проверить**

Run: `rg -n "Статус миграции|bug-hunter" docs/DEV_PROCESS_COVERAGE.md`
Expected: пусто.

- [ ] **Step 4: Commit**

```bash
git add docs/DEV_PROCESS_COVERAGE.md
git commit -m "docs(dev-process): удалить исполненный статус миграции, сжать by-stack дубль до ссылки"
```

---

### Task 8: CLAUDE.md — правила самоконтроля при правках фреймворков и документации

**Files:**
- Modify: `CLAUDE.md` (внутрь раздела `## Чек-лист при изменении плагинов`, новым подразделом после «Принципы содержания»)

- [ ] **Step 1: Добавить подраздел**

```markdown
### Самоконтроль при правках фреймворков и документации (docs/, CLAUDE.md)

Правила выведены из реальных рассинхронов (Reviewer-фазы разошлись между библиотекой и рецептом; лимит «250 символов» не подтверждён и нарушался собственными агентами).

- **Один факт — один нормативный дом.** Перед добавлением правила — `rg` по docs/ и CLAUDE.md: уже описано в другом месте → ссылка, не копия. CLAUDE.md держит строку-суть + ссылку, нормативный текст живёт в одном файле.
- **Фреймворк не впитывает содержимое артефактов.** Детали одной роли (таблицы меток, перечни маркеров, готовые формулировки) живут в референс-артефакте (агенте/skill), фреймворк — контракт + ссылка. Сигнал нарушения: запись в «библиотеке типовых фаз» длиннее 5-6 строк атрибутов.
- **Утверждение о поведении платформы Claude Code** (лимиты, обрезка, поддержка полей) — только со сверкой по официальной документации или живым экспериментом; источник фиксируется рядом. Недокументированное помечается «не задокументировано», цифры не выдумываются. Это анти-паттерн №11 SKILL_FRAMEWORK, применённый к docs.
- **Заявление «это проверяет валидатор» сверяется с кодом валидатора.** Лимит/правило в self-check без реальной проверки в `tools/validate-*.js` помечается как ручное (👁), не выдаётся за автоматическое.
- **Числа состояния каталога** (количество агентов/плагинов/строк) в нормативный текст не хардкодить — устаревают молча. Либо без числа («десятки»), либо там, где число и так бампается (marketplace.json).
- **Roadmap / «Что дальше» / «Статус миграции»** — не в нормативных доках; место — PR description и git history. Исключение — с датой и условием удаления.
- **После правки правила — кросс-сверка дублей:** `rg` по ключевым терминам изменённого правила по docs/ + CLAUDE.md; каждая найденная копия либо синхронизирована, либо сведена к ссылке.
```

- [ ] **Step 2: Проверить**

Run: `rg -n "Самоконтроль при правках фреймворков" CLAUDE.md`
Expected: 1 совпадение.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): правила самоконтроля при правках фреймворков и документации"
```

---

### Task 9: Финальная верификация и PR

- [ ] **Step 1: Прогнать валидаторы (регрессия)**

Run: `npm run validate`
Expected: 0 ошибок (plugins/ не трогали, но CI гоняет всё).

- [ ] **Step 2: Сверить отсутствие остатков**

Run: `rg -n "250 символов|39 агент|мягком режиме|Статус миграции" docs/ CLAUDE.md`
Expected: пусто.

Run: `rg -n "рецепт Reviewer" CLAUDE.md docs/AGENT_FRAMEWORK.md`
Expected: ссылки согласованы, состав фаз перечислен только в AGENT_FRAMEWORK.

- [ ] **Step 3: Push и PR в develop (без merge — ждать approve)**

```bash
git push -u origin docs/frameworks-dedup
gh pr create --base develop --title "docs: дедупликация фреймворков, фикс рассинхронов, правила самоконтроля docs" --body "## Что сделано

- AGENT_FRAMEWORK: Reviewer-фазы библиотеки срезаны до контрактов, полные правила (шкала меток, маркеры tech debt) — в референс-агенте mr-reviewer; рецепт получил ссылку на референс
- AGENT_FRAMEWORK: убран непроверенный лимит «250 символов» на description (валидатор не проверял, свои агенты нарушали) → честный ориентир ≤ 500; срезан самоочевидный глоссарий; удалён устаревший хвост миграции («39 агентов», «мягкий режим» — противоречил CLAUDE.md)
- CLAUDE.md: рецепт Reviewer — ссылка вместо третьей копии; command → agent в таблице композиции исправлен на «работает на практике» + конвенция команда-делегат (PR#51)
- COMMAND_FRAMEWORK: конвенция команда-делегат зафиксирована
- DEV_PROCESS_COVERAGE: удалён исполненный «Статус миграции», by-stack дубль сжат до ссылки
- CLAUDE.md: новый подраздел «Самоконтроль при правках фреймворков и документации» — правила против повторения найденных рассинхронов

plugins/ не тронут, semver-бампы не требуются." 2>&1 | cat
```

---

## Предусловие (Task 0): ветка

```bash
git checkout develop && git pull
git checkout -b docs/frameworks-dedup
```

Имя ветки по смыслу, без номеров задач (конвенция репо).
