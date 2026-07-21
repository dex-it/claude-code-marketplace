# Замыкание оракула в маркетплейсе - план реализации (этап 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Замкнуть цепочку оракула в конвейере агентов: появляется производитель критериев приёмки с метками `[FR-NNN]`, тестописатели и кодеры получают реальный оракул вместо halt-в-пустоту, лазейка «Deep Dive = оракул» закрыта.

**Architecture:** Правки существующих markdown-артефактов (агенты + process-skill `node-contract`), не код. `user-story-writer` и `architect` поднимаются в узлы конвейера и начинают производить `success criteria`/`acceptance criteria` с метками `[FR-NNN]`. Правило старшинства (продуктовый оракул > технический) встаёт в `node-contract`. Лазейка Deep Dive у кодеров закрывается ТОЛЬКО после появления производителя. Новый слот - реконструкция поведения legacy.

**Tech Stack:** Markdown-артефакты Claude Code (агенты `.md`, skill `SKILL.md`), валидаторы `tools/validate-*.js` (Node), `marketplace.json`.

## Global Constraints

Скопировано из спеки и CLAUDE.md, применяется к КАЖДОЙ задаче:

- **«Тест» в этом плане** = (1) прогон `npm run validate` с 0 ошибок + (2) сверка стыковки полей handoff: поле, которое производит узел N, дословно принимается узлом N+1. Unit-тестов на текст артефактов нет.
- **Оракул проверки = критерии приёмки, не реализация** (node-contract SKILL.md:138-141). Вывод оракула из реализации запрещён - «зеркалит её и цементирует её баги».
- **Старшинство оракулов:** продуктовый (`acceptance criteria` Given-When-Then от user-story-writer) > технический (`DoD` инкремента от architect). При конфликте побеждает наблюдаемое поведение для пользователя.
- **Порядок необратим:** производитель оракула (Задачи 2-3) появляется ДО закрытия лазейки Deep Dive (Задача 5). Иначе встаёт работающий сегодня конвейер.
- **Метка `[FR-NNN]`/`[NFR-NNN]`** наследуется по нити: FR из BRD -> критерий приёмки с меткой -> оракул теста с меткой. Обрыв метки = обрыв нити требования.
- **ASCII-пунктуация** в артефактах: `-` не `—`, `->` не `→` (CLAUDE.md).
- **Формулировки для LLM** - сухо, механизм/условие/исход, без воды. После правки любого артефакта гнать через `dex-skill-optimize-for-llm`.
- **Версии** бампаются в ДВУХ местах: `plugin.json` + `marketplace.json`. Добавление ловушек/фазы = minor, fix формулировки = patch.
- Валидатор: `node tools/validate-agent.js <path>` точечно, `npm run validate` целиком.

---

## Порядок задач и зависимости

```
Задача 1 (node-contract: правило старшинства + слот acceptance-criteria)
   |
   +-> Задача 2 (user-story-writer -> узел, продуктовый оракул)
   +-> Задача 3 (architect -> производит критерии приёмки [FR-NNN])
           |
           v
Задача 4 (сверка стыковки: производитель -> tester/coder принимают)
   |
   v
Задача 5 (закрыть лазейку Deep Dive у кодеров)  <- ТОЛЬКО после Задачи 4
   |
   v
Задача 6 (слот реконструкции legacy - новый skill)
   |
   v
Задача 7 (синхронизация: DEV_PROCESS_COVERAGE, marketplace, версии)
```

Задача 1 - предусловие для 2 и 3 (обе ссылаются на новый словарный слот и правило старшинства). Задача 5 блокирована Задачей 4 (нельзя закрывать лазейку, пока не доказано, что производитель кормит потребителя). Задача 6 независима от 2-5, но идёт после для чистого валидатора.

---

### Задача 1: node-contract - правило старшинства оракулов + слот acceptance criteria

**Files:**
- Modify: `plugins/ai-sdlc/dex-skill-node-contract/skills/node-contract/SKILL.md`
- Modify: `plugins/ai-sdlc/dex-skill-node-contract/.claude-plugin/plugin.json` (версия)
- Modify: `.claude-plugin/marketplace.json` (версия)

**Interfaces:**
- Produces: словарный слот `acceptance criteria` (Given-When-Then, продуктовый оракул) в handoff-словаре; правило «Старшинство оракулов». На них ссылаются Задачи 2, 3, 4, 5.

- [ ] **Step 1: Прочитать текущий раздел словаря и правило оракула**

Read: `SKILL.md`, строки 118-145 (словарь полей + раздел «Оракул проверки»).
Убедиться, что `success criteria` (строка 121) и `intent` (строка 126) на месте, раздел «Оракул проверки = критерии приёмки, не реализация» (138-141) на месте.

- [ ] **Step 2: Добавить слот `acceptance criteria` в словарь полей**

В таблицу словаря (после строки с `success criteria`, ~121) добавить строку:

```
| `acceptance criteria` | наблюдаемое поведение для пользователя в Given-When-Then; продуктовый оракул | user story AC; Gherkin-сценарий; каждый несёт метку `[FR-NNN]` источника |
```

Обоснование в теле (рядом с определением): `acceptance criteria` - продуктовая форма оракула (что видит пользователь), `success criteria`/`DoD` - техническая (как проверить инкремент). Оба - оракулы, судятся тестом.

- [ ] **Step 3: Добавить правило старшинства**

После раздела «Оракул проверки = критерии приёмки, не реализация» (после строки 141) добавить подраздел:

```markdown
### Старшинство оракулов при конфликте

Оракул приходит из двух источников: `acceptance criteria` (продуктовый, Given-When-Then, от постановщика продукта) и `success criteria`/`DoD` (технический, от архитектора). Расходятся - **продуктовый старше**: он судит бизнес-результат, технический - способ его достичь. Узел, проверяющий чужую работу (тест, ревью), при конфликте держится за `acceptance criteria`. Технический критерий, противоречащий продуктовому, - дефект спецификации, возврат оркестратору со `status: blocked`, не молчаливый выбор.
```

- [ ] **Step 4: Прогнать optimize-for-llm на изменённых блоках**

Вызвать Skill `dex-skill-optimize-for-llm:optimize-for-llm` на добавленных абзацах. Срезать воду, сохранить механизм/старшинство/статус. НЕ сокращать нормативную силу (halt, статусы).

- [ ] **Step 5: Бампнуть версию (minor - новый слот словаря + правило)**

В `plugin.json` и `marketplace.json` найти версию `dex-skill-node-contract`, поднять minor (`X.Y.Z` -> `X.(Y+1).0`). Обе записи синхронно.

- [ ] **Step 6: Тест - валидатор**

Run: `node tools/validate-skill.js plugins/ai-sdlc/dex-skill-node-contract/skills/node-contract/SKILL.md`
Expected: 0 ошибок. Если process-skill проверки ругаются на размер - node-contract в allowlist `PROCESS_SKILLS`, до 500 строк допустимо.

- [ ] **Step 7: Commit**

```bash
git add plugins/ai-sdlc/dex-skill-node-contract/ .claude-plugin/marketplace.json
git commit -m "feat(node-contract): слот acceptance criteria + правило старшинства оракулов"
```

---

### Задача 2: user-story-writer -> узел конвейера (продуктовый оракул)

**Files:**
- Modify: `plugins/specialists/product/dex-user-story-writer/agents/user-story-writer.md`
- Modify: `plugins/specialists/product/dex-user-story-writer/.claude-plugin/plugin.json` (версия)
- Modify: `.claude-plugin/marketplace.json` (версия)

**Interfaces:**
- Consumes: словарь и правило старшинства из Задачи 1.
- Produces: `Output (handoff)` с полем `acceptance criteria` (Given-When-Then + метки `[FR-NNN]`). Принимается тестописателем (Задача 4).

- [ ] **Step 1: Добавить node-contract в frontmatter**

В `user-story-writer.md` после `model: sonnet` (строка 5) добавить:

```yaml
skills:
  - dex-skill-node-contract:node-contract
```

Полная форма обязательна (`{plugin}:{skill}`), иначе не резолвится (CLAUDE.md).

- [ ] **Step 2: Добавить Input (handoff) в Phase 1**

В Phase 1 (после строки 20, перед списком Output) вставить блок по образцу business-analyst.md:20:

```markdown
**Input (handoff):** контракт стыка - в pre-loaded `node-contract`. Принимает: `[blocking]` источник (epic/requirement/feature с `FR-NNN` из BRD); `[default-ok]` `mode` (дефолт `autonomous`), контекст репо. Валидация входа: источник без единого `FR`/бизнес-цели -> бизнес-ось -> halt + возврат оркестратору (нечего превращать в истории), не додумывать.
```

- [ ] **Step 3: Привязать метку `[FR-NNN]` к acceptance criteria в Phase 3**

В Phase 3, в пункт «Acceptance Criteria» (строка 58), заменить:

```
- Acceptance Criteria: Given-When-Then scenarios (positive + negative + edge cases)
```

на:

```
- Acceptance Criteria: Given-When-Then scenarios (positive + negative + edge cases); каждый сценарий, происходящий из требования BRD, несёт метку `[FR-NNN]`/`[NFR-NNN]` источника. FR из входа без AC - дыра истории, не молчаливый пропуск.
```

- [ ] **Step 4: Добавить Output (handoff) в конец Phase 4**

После Exit criteria Phase 4 (после строки 87) добавить:

```markdown
**Output (handoff):** по контракту `node-contract` первым полем `status` (`complete`/`blocked`/`partial`), затем: перечень stories, `acceptance criteria` (Given-When-Then, продуктовый оракул, с метками `[FR-NNN]`), non-goals (что не покрыто историями), допущения. Это вход тест-инжиниринга и разработки; продуктовый оракул старше технического DoD (см. `node-contract`, «Старшинство оракулов»). Маршрут решает оркестратор.
```

- [ ] **Step 5: Снять запрет-отталкивание у business-analyst и requirements-analyst**

Проблема из инвентаризации: оба агента отталкивают user-story-writer, никто не подхватывает. Проверить Boundaries обоих:

Run: `rg -n "user.stor" plugins/specialists/product/dex-business-analyst/agents/*.md plugins/specialists/product/dex-requirements-analyst/agents/*.md`

Где стоит «Не писать user stories - это user-story-writer» - оставить (разделение верное), но убедиться, что в Output/handoff этих агентов есть **передача** источника с `FR-NNN` дальше в user-story-writer, а не тупик. Если передачи нет - добавить в Output строку «`FR`/`NFR` -> вход user-story-writer для acceptance criteria». (Точная правка зависит от текста; если передача уже есть - n/a, зафиксировать.)

- [ ] **Step 6: optimize-for-llm на изменённых блоках**

Вызвать `dex-skill-optimize-for-llm:optimize-for-llm` на добавленных handoff-блоках.

- [ ] **Step 7: Бампнуть версию (minor - агент стал узлом)**

`plugin.json` + `marketplace.json` синхронно, minor.

- [ ] **Step 8: Тест - валидатор + стыковка**

Run: `node tools/validate-agent.js plugins/specialists/product/dex-user-story-writer/agents/user-story-writer.md`
Expected: 0 ошибок.

Сверка стыковки (ручная): поле `acceptance criteria` в Output этого агента дословно есть в словаре node-contract (Задача 1, Step 2). Да -> ок.

- [ ] **Step 9: Commit**

```bash
git add plugins/specialists/product/ .claude-plugin/marketplace.json
git commit -m "feat(user-story-writer): узел конвейера, продуктовый оракул acceptance criteria [FR-NNN]"
```

---

### Задача 3: architect - производит критерии приёмки с [FR-NNN]

**Files:**
- Modify: `plugins/specialists/architecture/dex-architect/agents/architect.md`
- Modify: `plugins/specialists/architecture/dex-architect-dotnet/agents/architect-dotnet.md`
- Modify: соответствующие `plugin.json` (2 шт) + `marketplace.json`

**Interfaces:**
- Consumes: словарь + правило старшинства из Задачи 1.
- Produces: `Output (handoff)` с полем `success criteria` (критерии приёмки на инкремент, метки `[FR-NNN]`). Принимается кодером и тестописателем (Задача 4).

- [ ] **Step 1: Прочитать Phase 7 и Output обоих архитекторов**

Read: `architect.md` строки 260-301 (Phase 7 Implementation Plan + Output handoff).
Зафиксировать: сейчас есть `DoD` (строка 278) на инкремент и `success metric`, но НЕТ раздела «Критерии приёмки» с метками `[FR-NNN]` и НЕТ поля `success criteria` в Output. Это и есть дыра из спеки.

- [ ] **Step 2: Добавить производство критериев приёмки в Phase 7**

В Phase 7 (после блока про DoD, ~строка 278) добавить пункт:

```markdown
- **Критерии приёмки инкремента** - обязательно: проверяемый чеклист наблюдаемых фактов «готово», не описание решения. Критерий, происходящий из требования BRD, несёт метку `[FR-NNN]`/`[NFR-NNN]`. Гейт: `FR`/`NFR` из входа без критерия приёмки - дыра спеки, не молчаливый пропуск. Отличать от Deep Dive (Phase 6): Deep Dive - КАК устроено решение (схема, контракты); критерий приёмки - ЧТО наблюдаемо при «готово». Оракулом теста служит критерий, не Deep Dive.
```

- [ ] **Step 3: Добавить `success criteria` в Output (handoff)**

В Output-строке (301) после `implementation plan (инкременты с DoD + success metric)` вставить:

```
, success criteria (критерии приёмки инкремента с метками `[FR-NNN]`, продукт-оракул старше при конфликте - см. node-contract «Старшинство оракулов»)
```

- [ ] **Step 4: Повторить Steps 2-3 для architect-dotnet.md**

Read: `architect-dotnet.md`, найти Phase Implementation Plan и Output handoff (`rg -n "Phase|Output \(handoff\)|DoD"`).
Внести те же две правки. Формулировки идентичны (канва архитекторов единая - как канва кодеров, feedback_coder_canvas_alignment).

- [ ] **Step 5: optimize-for-llm на изменённых блоках обоих файлов**

- [ ] **Step 6: Бампнуть версии (minor - новая обязательная фаза-производство)**

Оба `plugin.json` + `marketplace.json`. Mandatory-фаза требует обоснования «почему mandatory» - оно в тексте пункта («дыра спеки»), валидатор проверит.

- [ ] **Step 7: Тест - валидатор**

Run: `node tools/validate-agent.js plugins/specialists/architecture/dex-architect/agents/architect.md && node tools/validate-agent.js plugins/specialists/architecture/dex-architect-dotnet/agents/architect-dotnet.md`
Expected: 0 ошибок. Если ругается на mandatory без обоснования - дописать «почему».

- [ ] **Step 8: Commit**

```bash
git add plugins/specialists/architecture/ .claude-plugin/marketplace.json
git commit -m "feat(architect): производство критериев приёмки [FR-NNN] как оракула теста"
```

---

### Задача 4: сверка стыковки производитель -> потребитель (без правок, только доказательство)

**Files:**
- Read-only: тестописатели и кодеры (проверка, что принимают новое поле).

**Interfaces:**
- Consumes: Output user-story-writer (Задача 2), Output architect (Задача 3).
- Produces: доказательство, что оракул доходит от производителя до потребителя. Разблокирует Задачу 5.

- [ ] **Step 1: Проверить, что тестописатель принимает acceptance criteria**

Run: `rg -n "success criteria|acceptance criteria|оракул" plugins/specialists/dotnet/dex-dotnet-tester/agents/*.md plugins/specialists/fullstack/dex-ts-tester/agents/*.md`

Ожидается: тестописатель принимает `success criteria` как оракул (dotnet-test-writer.md:22). Проверить: слово `acceptance criteria` засчитывается как синоним? В node-contract словаре (Задача 1) `acceptance criteria` - отдельный слот, продуктовый оракул. Тестописатель должен принимать ОБА (продуктовый и технический), с продуктовым старше.

Если тестописатель принимает только `success criteria` - добавить в его Input строку: «`acceptance criteria` (продуктовый оракул) принимается наравне с `success criteria`; при конфликте продуктовый старше (node-contract)». Это правка -> под-коммит.

- [ ] **Step 2: Проверить цепочку меток [FR-NNN]**

Ручная сверка нити: user-story-writer производит AC с `[FR-NNN]` (Задача 2 Step 3) -> тестописатель обязан ли протянуть метку в тест? Инвентаризация нашла: `tracks/requirements.md:88-91` признаёт, что трассировка `[FR-NNN]->тест` НЕ требуется exit-criteria тестописателей.

Решение: добавить в Exit criteria тестописателей мягкое требование трассировки (не halt, но пометка): «тест, покрывающий критерий с `[FR-NNN]`, наследует метку в имени/комментарии - иначе нить требования обрывается». Правка обоих тестописателей -> под-коммит.

- [ ] **Step 3: Тест - валидатор после правок Step 1-2**

Run: `npm run validate:agents`
Expected: 0 ошибок.

- [ ] **Step 4: Commit (если были правки в Step 1-2)**

```bash
git add plugins/specialists/dotnet/dex-dotnet-tester/ plugins/specialists/fullstack/dex-ts-tester/ .claude-plugin/marketplace.json
git commit -m "feat(testers): принимают acceptance criteria как продукт-оракул + трассировка [FR-NNN]"
```

Если правок не было (потребители уже принимают) - зафиксировать это в сообщении следующего коммита, коммит пропустить.

---

### Задача 5: закрыть лазейку Deep Dive у кодеров (ТОЛЬКО после Задачи 4)

**Files:**
- Modify: `plugins/specialists/dotnet/dex-dotnet-coder/agents/dotnet-coder.md:57`
- Modify: `plugins/specialists/fullstack/dex-ts-fullstack-coder/agents/ts-fullstack-assistant.md` (аналогичная строка)
- Modify: `plugin.json` (2) + `marketplace.json`

**Interfaces:**
- Consumes: доказательство из Задачи 4, что производитель кормит потребителя (иначе закрытие лазейки останавливает конвейер).

- [ ] **Step 1: ПРЕДУСЛОВИЕ - подтвердить, что Задачи 2-4 закоммичены**

Run: `git log --oneline -6 | cat`
Ожидается: коммиты Задач 1, 2, 3 (и 4, если были правки) на месте. Нет производителя оракула -> НЕ продолжать (закрытие лазейки без производителя = мёртвый конвейер, halt всех тестов/кода).

- [ ] **Step 2: Убрать Deep Dive из синонимов success criteria (dotnet-coder)**

В `dotnet-coder.md:57` заменить:

```
`[blocking]` `success criteria` (синонимы засчитывать по смыслу: DoD, acceptance criteria, scope+Deep Dive от architect)
```

на:

```
`[blocking]` `success criteria` (синонимы по смыслу: DoD инкремента, acceptance criteria от постановщика - продуктовый старше при конфликте. Deep Dive НЕ засчитывается: он описывает решение, не проверяемый критерий «готово» - принять его за оракул = сделать реализацию собственным оракулом, node-contract это запрещает)
```

- [ ] **Step 3: Повторить для ts-fullstack-coder**

Run: `rg -n "Deep Dive|success criteria.*синоним" plugins/specialists/fullstack/dex-ts-fullstack-coder/agents/*.md`
Внести идентичную правку (канва кодеров единая - feedback_coder_canvas_alignment: правка одной оси -> обоим дословно).

- [ ] **Step 4: optimize-for-llm на изменённых строках**

- [ ] **Step 5: Бампнуть версии (minor - изменение правила валидации входа)**

- [ ] **Step 6: Тест - валидатор**

Run: `npm run validate:agents`
Expected: 0 ошибок.

- [ ] **Step 7: Commit**

```bash
git add plugins/specialists/dotnet/dex-dotnet-coder/ plugins/specialists/fullstack/dex-ts-fullstack-coder/ .claude-plugin/marketplace.json
git commit -m "fix(coders): Deep Dive больше не синоним оракула - закрыта лазейка реализация-как-оракул"
```

---

### Задача 6: слот реконструкции поведения legacy (новый skill)

**Files:**
- Create: `plugins/skills/dex-skill-legacy-reconstruction/skills/legacy-reconstruction/SKILL.md`
- Create: `plugins/skills/dex-skill-legacy-reconstruction/.claude-plugin/plugin.json`
- Modify: `.claude-plugin/marketplace.json` (регистрация + версия каталога)

**Interfaces:**
- Produces: process-skill дисциплины «восстановить оракул из кода, когда постановки не было». Грузится debugger/discover-агентами при brownfield-входе.

- [ ] **Step 1: Проверить, что слот реально пуст**

Run: `rg -il "legacy|реконструкц|характеризац|characterization|восстанов.*поведени" plugins/ | rg -v node_modules`
Ожидается: подтверждение из инвентаризации - нет skill про восстановление контракта из кода.

- [ ] **Step 2: Написать SKILL.md**

Это process-skill (дисциплина, не каталог граблей). Маркер `<!-- skill-type: process -->` в теле. Содержание - 3-шаговая дисциплина из спеки:

```markdown
---
name: legacy-reconstruction
description: Восстановление оракула из legacy-кода, когда постановки никогда не было. Активируется при legacy без ТЗ, характеризационные тесты, нет спецификации, brownfield без постановки, восстановить поведение из кода, reverse-engineer поведение, оракул для унаследованного кода, тесты на старый код
---

<!-- skill-type: process -->

# Реконструкция оракула из legacy

Код без постановки нельзя покрыть тестами напрямую - оракула нет, тест зеркалит реализацию и цементирует её баги (node-contract, «Оракул проверки != реализация»). Дисциплина восстановления оракула:

## Три шага, средний не пропускается

| Шаг | Кто | Выход |
|---|---|---|
| 1. Реконструкция | агент (опора - обзор dex-code-discovery) | черновик спецификации: предполагаемое поведение из кода |
| 2. Валидация | **человек** | размечено: где предполагаемое = замысел, где = баг в проде |
| 3. Тесты | тест-агент | тесты против ВАЛИДИРОВАННОГО оракула (шаг 2), не против кода |

## Почему шаг 2 не автоматизируется

Агент, читающий код, не отличает замысел от бага - и то и другое «как код себя ведёт». Только человек знает, что `if (x < 0) return 0` - это защита (замысел) или проглоченная ошибка (баг). Пропустить шаг 2 -> тесты на шаге 3 зафиксируют баг как контракт. Это цена, не опция: без валидации человеком реконструкция не даёт оракула.

## Граница

- НЕ выдавать реконструкцию за постановку: черновик спецификации помечается «реконструировано, не согласовано» до валидации.
- НЕ писать характеризационные тесты как проверку корректности: тест на невалидированное поведение фиксирует «как есть», не «как должно». Помечать явно.
```

- [ ] **Step 3: Написать plugin.json**

```json
{
  "name": "dex-skill-legacy-reconstruction",
  "version": "1.0.0",
  "description": "Восстановление оракула из legacy-кода без постановки: реконструкция -> валидация человеком -> тесты"
}
```

- [ ] **Step 4: Зарегистрировать в PROCESS_SKILLS валидатора**

В `tools/validate-skill.js` найти allowlist `PROCESS_SKILLS`, добавить `legacy-reconstruction`. Иначе валидатор применит trap-эвристики к process-skill.

Run: `rg -n "PROCESS_SKILLS" tools/validate-skill.js`

- [ ] **Step 5: Зарегистрировать в marketplace.json + бампнуть версию каталога**

Добавить запись плагина (по образцу соседних skill). Верхнеуровневый `version` каталога - minor (новый плагин).

- [ ] **Step 6: optimize-for-llm на SKILL.md**

- [ ] **Step 7: Тест - валидатор**

Run: `node tools/validate-skill.js plugins/skills/dex-skill-legacy-reconstruction/skills/legacy-reconstruction/SKILL.md`
Expected: 0 ошибок. Process-skill освобождён от too-few-traps.

- [ ] **Step 8: Commit**

```bash
git add plugins/skills/dex-skill-legacy-reconstruction/ tools/validate-skill.js .claude-plugin/marketplace.json
git commit -m "feat(legacy-reconstruction): process-skill восстановления оракула из legacy-кода"
```

---

### Задача 7: синхронизация карты, каталога, финальный прогон

**Files:**
- Modify: `docs/DEV_PROCESS_COVERAGE.md`
- Verify: `.claude-plugin/marketplace.json`

**Interfaces:**
- Consumes: все предыдущие задачи.

- [ ] **Step 1: Обновить DEV_PROCESS_COVERAGE.md**

Внести в карту:
- user-story-writer как узел слота постановки (продуктовый оракул). Раньше его в карте не было.
- architect как производитель критериев приёмки `[FR-NNN]` (уточнить строки 65-66, где это уже заявлено, но было неверно - теперь механизм есть).
- legacy-reconstruction как слот brownfield-входа.

Read перед правкой: `docs/DEV_PROCESS_COVERAGE.md` строки 60-90.

- [ ] **Step 2: Кросс-сверка дублей (правило CLAUDE.md)**

Run: `rg -n "acceptance criteria|критери.*приёмк|success criteria|Deep Dive" docs/ CLAUDE.md`
Каждую копию правила - либо синхронизировать с новым node-contract, либо свести к ссылке. Один факт - один нормативный дом.

- [ ] **Step 3: Финальный полный прогон валидатора**

Run: `npm run validate`
Expected: 0 ошибок по всем осям (agents, skills, commands, bundles).

- [ ] **Step 4: Проверить синхронность версий**

Run: `node -e "const m=require('./.claude-plugin/marketplace.json'); ['dex-skill-node-contract','dex-user-story-writer','dex-architect','dex-architect-dotnet','dex-dotnet-coder','dex-ts-fullstack-coder','dex-skill-legacy-reconstruction'].forEach(n=>{const p=m.plugins.find(x=>x.name===n); console.log(n, p?p.version:'НЕ НАЙДЕН')})" 2>&1 | cat`
Expected: у всех тронутых плагинов версия поднята; legacy-reconstruction = 1.0.0.

Для каждого сверить с его `plugin.json` (версии в двух местах должны совпадать).

- [ ] **Step 5: Commit**

```bash
git add docs/DEV_PROCESS_COVERAGE.md .claude-plugin/marketplace.json
git commit -m "docs: DEV_PROCESS_COVERAGE - производители оракула + слот legacy; кросс-сверка"
```

---

## Прогон сквозной фичи (верификация этапа 1 - ОТДЕЛЬНО от правок)

**Не часть кодовых задач** - это ручной прогон на своей команде после Задач 1-7. Цель - не сделать фичу, а узнать, где цепочка рвётся после починки. Описан в спеке (раздел «Прогон-верификация этапа 1»). Провести на реальной задаче из бэклога, с человеком на каждом гейте, зафиксировать в `adoption/cases/dex-it.md` (создаётся на этапе 2). Результат прогона - вход для написания playbook (этап 2), который этот план НЕ покрывает намеренно: playbook пишется по следам работающего конвейера, не вперёд.

---

## Self-Review

**Spec coverage (этап 1 спеки):**
- «Два производителя с правилом старшинства» -> Задачи 1 (правило), 2 (user-story-writer), 3 (architect). ✓
- «Закрыть лазейку Deep Dive после производителя» -> Задача 5, блокирована Задачей 4. ✓
- «Реконструкция legacy как отдельный слот» -> Задача 6. ✓
- «Прогон сквозной фичи» -> отдельный раздел, вне кодовых задач (правильно - ручной). ✓
- Старшинство «продуктовый > технический» -> Global Constraints + Задача 1 Step 3. ✓
- Порядок «производитель -> потом закрытие лазейки» -> зависимости + Задача 5 Step 1 (предусловие). ✓

**Placeholder scan:** код-блоки правок конкретны (точные строки, точный текст). Задача 5 Step 3 и Задача 4 содержат «зависит от текста / если правок не было» - это не placeholder, а честная развилка с названным исходом (n/a + фиксация). Допустимо.

**Type consistency:** поле `acceptance criteria` определяется в Задаче 1, производится в Задаче 2, принимается в Задаче 4 - имя дословно совпадает. `success criteria` - существующее поле, не переименовано. Метка `[FR-NNN]` единообразна во всех задачах. ✓

**Открытый риск:** Задача 2 Step 5 и Задача 4 Steps 1-2 содержат правки, точная форма которых зависит от текущего текста агентов (передача источника, синонимы). Исполнитель читает файл и решает по факту, исход назван (добавить строку / n/a). Это не placeholder, но требует чтения - отмечено в шагах.
