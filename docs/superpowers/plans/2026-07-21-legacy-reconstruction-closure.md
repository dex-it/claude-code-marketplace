# Legacy-Reconstruction Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Замкнуть осиротевший `dex-skill-legacy-reconstruction`, назначив его 4 узлам-потребителям (business-requirements-analyst, requirements-analyst, mr-reviewer, debugger) с hard-gate загрузкой «код без ТЗ», и добавить его в 5 бандлов.

**Architecture:** Каждый агент-потребитель получает слот загрузки скилла в своей фазе Deep Scan (у аналитиков и debugger - Phase 3 «Skill-Based Deep Scan»; у mr-reviewer intent-gate живёт в Phase 6 «Falsification and Scoring») с прозаическим hard-gate-условием (без меток-операторов, по конвенции репо): нет ТЗ -> грузи обязательно; ТЗ есть -> не грузи. debugger дополнительно снимает глухой halt на отсутствие «ожидаемого поведения», превращая реконструкцию в гипотезу (не success criteria). Каждый включающий агента бандл получает скилл в `includes[]` (правило `bundle-not-closed`).

**Tech Stack:** Markdown-артефакты плагинов (agents/*.md, bundle.json, plugin.json), `.claude-plugin/marketplace.json`, валидаторы `tools/validate-*.js` (`npm run validate`), `optimize-for-llm` skill.

## Global Constraints

- Пунктуация в артефактах - ASCII (`-`, `->`, `!=`), не Unicode.
- Формулировки для LLM: механизм/условие/исход, без воды; терминал ветки закрыт с обеих сторон (есть ТЗ / нет ТЗ).
- Скилл грузится полной формой `dex-skill-legacy-reconstruction:legacy-reconstruction` (иначе не резолвится).
- Версии бампаются в паре: `plugin.json` + `.claude-plugin/marketplace.json`.
- Тело `legacy-reconstruction/SKILL.md` НЕ трогаем - дисциплина 3 шагов и статусы уже корректны.
- Версия каталога (`marketplace.json` верхнеуровневое `version: 5.32.0`) НЕ меняется - плагины не добавляются/не удаляются.
- Каждую правку артефакта перед сдачей прогнать через `optimize-for-llm`.
- `legacy-reconstruction` - язык-нейтральный process-skill, исключение by-stack на него не распространяется (в каждый бандл-потребитель обязателен).

---

## File Structure

- 4 агента (`*.md`) - добавить слот загрузки скилла в Phase 3; у debugger + правка halt-поведения во Input и Phase 3.
- 4 `plugin.json` агентов + 5 `plugin.json` бандлов - minor bump.
- 5 `bundle.json` - добавить `dex-skill-legacy-reconstruction` в `includes[]`.
- `.claude-plugin/marketplace.json` - синхронный minor bump 9 записей (4 агента + 5 бандлов).
- `docs/superpowers/plans/2026-07-15-oracle-closure.md:349` - правка ложной сноски.

Порядок задач: сначала агенты (Task 1-4), затем бандлы (Task 5), затем marketplace-синхронизация (Task 6), затем сноска плана (Task 7), финал - валидация (Task 8). Границы задач - по независимому гейту ревьюера: каждый агент отдельно, все бандлы вместе (одна механическая правка), marketplace отдельно (единый файл, легко разъехаться).

---

### Task 1: Слот в business-requirements-analyst

**Files:**
- Modify: `plugins/specialists/product/dex-business-analyst/agents/business-requirements-analyst.md` (Phase 3, после блока `dex-skill-nfr`, ~строка 78)
- Modify: `plugins/specialists/product/dex-business-analyst/.claude-plugin/plugin.json` (version 2.2.0 -> 2.3.0)

**Interfaces:**
- Consumes: существующая Phase 3 «Skill-Based Deep Scan» с загрузкой doc-standards/requirement-quality/nfr через Skill tool.
- Produces: новый пункт загрузки `dex-skill-legacy-reconstruction:legacy-reconstruction` под hard-gate «код без ТЗ». Формулировка слота (переиспользуется дословно в Task 2-4 с поправкой на роль) - см. Step 1.

- [ ] **Step 1: Добавить слот загрузки в Phase 3**

В файле `.../business-requirements-analyst.md` найти в Phase 3 строку с `dex-skill-nfr:nfr` (заканчивается «... не "инженеры решат".») и сразу ПОСЛЕ неё вставить новый bullet:

```markdown
- `dex-skill-legacy-reconstruction:legacy-reconstruction` - **только если вход код без постановки** (brownfield: ТЗ на эту функциональность никогда не было, требования надо восстановить из поведения кода). Веди реконструкцию оракула по дисциплине скилла. Постановка/BRD на входе есть - скилл не грузится, реконструировать нечего. Реконструированные требования - гипотеза со статусом «реконструировано, не согласовано» (ярлык тела скилла; валидация человеком, автономному узлу недоступна); открытый вопрос «замысел или дефект» уходит наверх оркестратору, не выдаётся за принятое требование.
```

- [ ] **Step 2: Bump версии в plugin.json**

В `.../dex-business-analyst/.claude-plugin/plugin.json` заменить `"version": "2.2.0"` на `"version": "2.3.0"`.

- [ ] **Step 3: Прогнать optimize-for-llm на добавленном слоте**

Инвокировать skill `optimize-for-llm` на новом bullet; применить сокращения, не трогая нормативную силу (условие/статусы/терминал ветки не резать).

- [ ] **Step 4: Провалидировать агента**

Run: `npm run validate:agents`
Expected: PASS, 0 ошибок (mandatory-фазы уже обоснованы, новый слот - не mandatory-фаза).

- [ ] **Step 5: Commit**

```bash
git add plugins/specialists/product/dex-business-analyst/agents/business-requirements-analyst.md plugins/specialists/product/dex-business-analyst/.claude-plugin/plugin.json
git commit -m "feat(business-requirements-analyst): слот legacy-reconstruction при коде без ТЗ"
```

---

### Task 2: Слот в requirements-analyst

**Files:**
- Modify: `plugins/specialists/product/dex-requirements-analyst/agents/requirements-analyst.md` (Phase 3, после блока `dex-skill-requirement-quality`, ~строка 78)
- Modify: `plugins/specialists/product/dex-requirements-analyst/.claude-plugin/plugin.json` (version 1.4.0 -> 1.5.0)

**Interfaces:**
- Consumes: Phase 3 с загрузкой `dex-skill-requirement-quality:requirement-quality` как оракула единицы.
- Produces: слот legacy-reconstruction с тем же hard-gate, роль - «детализация FR/NFR поверх кода без исходного набора».

- [ ] **Step 1: Добавить слот загрузки в Phase 3**

В `.../requirements-analyst.md` найти в Phase 3 абзац, начинающийся «Загрузи `dex-skill-requirement-quality:requirement-quality` - оракул единицы требования ...» (заканчивается «... не правится молча.») и сразу ПОСЛЕ него вставить новый абзац:

```markdown
Если вход - код без постановки (детализируем FR/NFR поверх brownfield, где ТЗ на эту функциональность никогда не было), загрузи `dex-skill-legacy-reconstruction:legacy-reconstruction` и веди реконструкцию требований по её дисциплине. Постановка/BRD на входе есть - скилл не грузится. Реконструированное - гипотеза «реконструировано, не согласовано» (ярлык тела скилла; валидация человеком, автономному узлу недоступна); «замысел или дефект» уходит наверх, не проставляется как принятое требование.
```

- [ ] **Step 2: Bump версии в plugin.json**

В `.../dex-requirements-analyst/.claude-plugin/plugin.json` заменить `"version": "1.4.0"` на `"version": "1.5.0"`.

- [ ] **Step 3: Прогнать optimize-for-llm на добавленном слоте**

Инвокировать `optimize-for-llm` на новом абзаце; нормативную силу не резать.

- [ ] **Step 4: Провалидировать агента**

Run: `npm run validate:agents`
Expected: PASS, 0 ошибок.

- [ ] **Step 5: Commit**

```bash
git add plugins/specialists/product/dex-requirements-analyst/agents/requirements-analyst.md plugins/specialists/product/dex-requirements-analyst/.claude-plugin/plugin.json
git commit -m "feat(requirements-analyst): слот legacy-reconstruction при коде без ТЗ"
```

---

### Task 3: Слот в mr-reviewer

**Files:**
- Modify: `plugins/specialists/review/dex-mr-reviewer/agents/mr-reviewer.md` (Phase 6 «Falsification and Scoring», у блока intent-gate / `intent: n/a`, ~строка 153)
- Modify: `plugins/specialists/review/dex-mr-reviewer/.claude-plugin/plugin.json` (version 1.8.0 -> 1.9.0)

**Interfaces:**
- Consumes: Phase 6, строка про `dex-skill-review-evidence:review-evidence` + intent-gate («источник отсутствует -> ось помечается `intent: n/a`, корректностные находки не глушатся»).
- Produces: слот legacy-reconstruction, привязанный к ветке `intent: n/a` - ревью кода без источника-намерения.

- [ ] **Step 1: Добавить слот загрузки к intent-gate**

В `.../mr-reviewer.md` найти в Phase 6 абзац, начинающийся «Загрузи `dex-skill-review-evidence:review-evidence` и примени intent-gate ...». В конец этого абзаца (после «... желательность фичи по сути не оценивается.» и перечня северностей - вставить ПЕРЕД строкой «Севериности: CRITICAL ...») добавить предложение:

```markdown
Источник намерения отсутствует (`intent: n/a`) и в diff есть исполняемый код: загрузи `dex-skill-legacy-reconstruction:legacy-reconstruction` и реконструируй ожидаемое поведение по её дисциплине как опору для корректностных находок. Кода в diff нет - скилл не грузится (реконструировать нечего). Реконструированное - гипотеза «реконструировано, не согласовано» (ярлык тела скилла; шаг 2 - валидация человеком - автономному узлу недоступен), в тред автору идёт как предположение об ожидаемом, не как установленное требование; расхождение «замысел или дефект» - вопрос наверх, не безусловная находка. Источник намерения на входе есть - скилл не грузится, сверка идёт против него.
```

- [ ] **Step 2: Bump версии в plugin.json**

В `.../dex-mr-reviewer/.claude-plugin/plugin.json` заменить `"version": "1.8.0"` на `"version": "1.9.0"`.

- [ ] **Step 3: Прогнать optimize-for-llm на добавленном слоте**

Инвокировать `optimize-for-llm`; нормативную силу не резать.

- [ ] **Step 4: Провалидировать агента**

Run: `npm run validate:agents`
Expected: PASS, 0 ошибок.

- [ ] **Step 5: Commit**

```bash
git add plugins/specialists/review/dex-mr-reviewer/agents/mr-reviewer.md plugins/specialists/review/dex-mr-reviewer/.claude-plugin/plugin.json
git commit -m "feat(mr-reviewer): слот legacy-reconstruction при intent: n/a"
```

---

### Task 4: Слот в debugger + снятие глухого halt

**Files:**
- Modify: `plugins/specialists/delivery/dex-debugger/agents/debugger.md` (Input ~строка 31; autonomous-режим ~строка 20; Phase 3 ~строка 65)
- Modify: `plugins/specialists/delivery/dex-debugger/.claude-plugin/plugin.json` (version 2.1.0 -> 2.2.0)

**Interfaces:**
- Consumes: Input `[blocking]` «ожидаемое корректное поведение ... нет его -> halt + возврат» (строка 31); autonomous «бизнес-неоднозначность -> halt» (строка 20); Phase 3 «Всегда - `dex-skill-solid:solid`» (строка 65).
- Produces: реконструкция-как-гипотеза вместо глухого halt при отсутствии «ожидаемого»; вердикт «ожидаемое реконструировано, не подтверждено» наверх. Тавтология (эталон из багованного кода) отмечена; лог/стек-трейс частично размыкает опору.

Это самая тонкая задача: меняется поведение blocking-halt. Правки в трёх местах должны быть согласованы - halt снимается, но только до гипотезы, не до success criteria.

- [ ] **Step 1: Смягчить halt во Input (строка 31)**

В `.../debugger.md` найти в блоке Input текст `«ожидаемое корректное поведение (success criteria расследования - без него нечем мерить "починено")»` и следующий за ним `«Симптом или ожидаемое поведение отсутствует -> halt + возврат оркестратору (расследовать/мерить нечего).»`. Заменить второе предложение на:

```markdown
Симптом отсутствует -> halt + возврат оркестратору (расследовать нечего). Симптом есть, но ожидаемое поведение отсутствует -> не halt: в Phase 3 реконструируй ожидаемое из кода (что планировали, что реализовано) и приложенного лога/стек-трейса, если он есть, как гипотезу того, что считать багом (не success criteria фикса). Ни симптома, ни ожидаемого -> halt.
```

- [ ] **Step 2: Добавить слот реконструкции в Phase 3 (строка 65)**

В `.../debugger.md` найти в Phase 3 строку `- **Всегда** - \`dex-skill-solid:solid\` ...` и сразу ПОСЛЕ неё (перед `- **Профильные по стеку**`) вставить:

```markdown
- **Если «ожидаемое корректное поведение» не пришло на вход** (симптом есть, лог/стек-трейс - если приложен) - `dex-skill-legacy-reconstruction:legacy-reconstruction`: реконструируй ожидаемое из кода (что планировали / что реализовано) и приложенного лога, если он есть. Опора частично закольцована (эталон выводится из того же кода, где баг); лог/стек-трейс, когда приложен, - внешний рантайм-сигнал, размыкает не полностью, без него опора целиком из кода. Поэтому реконструированное служит только гипотезой, что считать багом (сформулировать расследуемое расхождение), никогда - success criteria фикса. Вердикт «ожидаемое реконструировано, не подтверждено» уходит наверх: замысел это или дефект - решает человек/постановщик. Ожидаемое на входе есть - скилл не грузится. Реконструкция не даёт даже гипотезы расхождения - прежний halt + возврат.
```

- [ ] **Step 3: Согласовать autonomous-режим (строка 20)**

В `.../debugger.md` найти в блоке про `autonomous` текст `«Бизнес-неоднозначность (что считать корректным поведением, какой из вариантов "правильный") -> halt + возврат оркестратору, не угадывай.»` и заменить на:

```markdown
Бизнес-неоднозначность (что считать корректным поведением, какой из вариантов "правильный") -> не угадывай: если ожидаемого нет на входе, реконструируй его как гипотезу (Phase 3, `legacy-reconstruction`) и верни вердикт «реконструировано, не подтверждено» наверх; реконструкция не дала гипотезы -> halt + возврат.
```

- [ ] **Step 4: Bump версии в plugin.json**

В `.../dex-debugger/.claude-plugin/plugin.json` заменить `"version": "2.1.0"` на `"version": "2.2.0"`.

- [ ] **Step 5: Прогнать optimize-for-llm на трёх правках**

Инвокировать `optimize-for-llm` на изменённых Input/autonomous/Phase 3 фрагментах; терминалы веток halt/не-halt и статусы не резать.

- [ ] **Step 6: Провалидировать агента**

Run: `npm run validate:agents`
Expected: PASS, 0 ошибок. Проверить, что mandatory-фазы (Reproduce, Verify) и их обоснования не задеты.

- [ ] **Step 7: Commit**

```bash
git add plugins/specialists/delivery/dex-debugger/agents/debugger.md plugins/specialists/delivery/dex-debugger/.claude-plugin/plugin.json
git commit -m "feat(debugger): реконструкция-гипотеза вместо halt при отсутствии ожидаемого"
```

---

### Task 5: Замыкание 5 бандлов

**Files:**
- Modify: `plugins/bundles/dex-bundle-product-manager/bundle.json` (+ includes)
- Modify: `plugins/bundles/dex-bundle-product-manager/.claude-plugin/plugin.json` (1.5.1 -> 1.6.0)
- Modify: `plugins/bundles/dex-bundle-system-analyst/bundle.json` (+ includes)
- Modify: `plugins/bundles/dex-bundle-system-analyst/.claude-plugin/plugin.json` (1.7.0 -> 1.8.0)
- Modify: `plugins/bundles/dex-bundle-code-review/bundle.json` (+ includes)
- Modify: `plugins/bundles/dex-bundle-code-review/.claude-plugin/plugin.json` (1.10.0 -> 1.11.0)
- Modify: `plugins/bundles/dex-bundle-dotnet-developer/bundle.json` (+ includes)
- Modify: `plugins/bundles/dex-bundle-dotnet-developer/.claude-plugin/plugin.json` (2.7.0 -> 2.8.0)
- Modify: `plugins/bundles/dex-bundle-dotnet-fullstack/bundle.json` (+ includes)
- Modify: `plugins/bundles/dex-bundle-dotnet-fullstack/.claude-plugin/plugin.json` (2.7.0 -> 2.8.0)

**Interfaces:**
- Consumes: агенты из Task 1-4, каждый теперь грузит `dex-skill-legacy-reconstruction:legacy-reconstruction`.
- Produces: замкнутые бандлы - `dex-skill-legacy-reconstruction` в `includes[]` каждого. product-manager несёт business-requirements-analyst; system-analyst - requirements-analyst; code-review/dotnet-developer/dotnet-fullstack - mr-reviewer; dotnet-developer/dotnet-fullstack дополнительно несут debugger (тот же скилл, отдельная строка не нужна).

- [ ] **Step 1: Добавить скилл в includes[] пяти бандлов**

В каждый из пяти `bundle.json` добавить строку `"dex-skill-legacy-reconstruction"` в массив `includes` (порядок в массиве не важен, добавить последней строкой перед `]`, не забыв запятую на предыдущей). Файлы: `dex-bundle-product-manager`, `dex-bundle-system-analyst`, `dex-bundle-code-review`, `dex-bundle-dotnet-developer`, `dex-bundle-dotnet-fullstack`.

- [ ] **Step 2: Bump версий пяти plugin.json бандлов**

- `dex-bundle-product-manager/.claude-plugin/plugin.json`: `1.5.1` -> `1.6.0`
- `dex-bundle-system-analyst/.claude-plugin/plugin.json`: `1.7.0` -> `1.8.0`
- `dex-bundle-code-review/.claude-plugin/plugin.json`: `1.10.0` -> `1.11.0`
- `dex-bundle-dotnet-developer/.claude-plugin/plugin.json`: `2.7.0` -> `2.8.0`
- `dex-bundle-dotnet-fullstack/.claude-plugin/plugin.json`: `2.7.0` -> `2.8.0`

- [ ] **Step 3: Провалидировать замкнутость бандлов**

Run: `npm run validate:bundles`
Expected: PASS, 0 ошибок; правило `bundle-not-closed` по пяти тронутым бандлам зелёное (агент грузит скилл, скилл в includes).

- [ ] **Step 4: Commit**

```bash
git add plugins/bundles/dex-bundle-product-manager plugins/bundles/dex-bundle-system-analyst plugins/bundles/dex-bundle-code-review plugins/bundles/dex-bundle-dotnet-developer plugins/bundles/dex-bundle-dotnet-fullstack
git commit -m "feat(bundles): замкнуть legacy-reconstruction в 5 бандлах-потребителях"
```

---

### Task 6: Синхронизация marketplace.json

**Files:**
- Modify: `.claude-plugin/marketplace.json` (9 записей: 4 агента + 5 бандлов; верхнеуровневый `version` НЕ трогать)

**Interfaces:**
- Consumes: версии, выставленные в plugin.json (Task 1-5). marketplace.json обязан совпадать с ними попарно.
- Produces: согласованный каталог - валидатор не падает на рассинхроне версий.

- [ ] **Step 1: Синхронно поднять версии 9 записей**

В `.claude-plugin/marketplace.json` найти каждую запись по `"name"` и поднять её `"version"` до значения из соответствующего plugin.json:

- `dex-business-analyst`: `2.3.0`
- `dex-requirements-analyst`: `1.5.0`
- `dex-mr-reviewer`: `1.9.0`
- `dex-debugger`: `2.2.0`
- `dex-bundle-product-manager`: `1.6.0`
- `dex-bundle-system-analyst`: `1.8.0`
- `dex-bundle-code-review`: `1.11.0`
- `dex-bundle-dotnet-developer`: `2.8.0`
- `dex-bundle-dotnet-fullstack`: `2.8.0`

Верхнеуровневый `"version": "5.32.0"` каталога оставить как есть (плагины не добавляются/не удаляются).

- [ ] **Step 2: Сверить попарно plugin.json vs marketplace.json**

Run:
```bash
for p in dex-business-analyst dex-requirements-analyst dex-mr-reviewer dex-debugger dex-bundle-product-manager dex-bundle-system-analyst dex-bundle-code-review dex-bundle-dotnet-developer dex-bundle-dotnet-fullstack; do
  mv=$(grep -A3 "\"name\": \"$p\"" .claude-plugin/marketplace.json | grep '"version"' | head -1)
  echo "$p marketplace: $mv"
done
```
Expected: значения совпадают с bump-таблицей Step 1.

- [ ] **Step 3: Commit**

```bash
git add .claude-plugin/marketplace.json
git commit -m "chore(marketplace): синхронизировать версии 4 агентов + 5 бандлов"
```

---

### Task 7: Правка ложной сноски плана PR #118

**Files:**
- Modify: `docs/superpowers/plans/2026-07-15-oracle-closure.md:349`

**Interfaces:**
- Consumes: реальность из спеки - потребители суть аналитики требований + mr-reviewer + debugger; discover исключён.
- Produces: сноска плана без ложной декларации (discover как потребитель) и с уточнённым механизмом debugger.

- [ ] **Step 1: Заменить строку 349**

Найти в `docs/superpowers/plans/2026-07-15-oracle-closure.md` строку:
```
- Produces: process-skill дисциплины «восстановить оракул из кода, когда постановки не было». Грузится debugger/discover-агентами при brownfield-входе.
```
Заменить на:
```
- Produces: process-skill дисциплины «восстановить оракул из кода, когда постановки не было». Грузится потребителями при входе «код без ТЗ»: аналитики требований (business-requirements-analyst, requirements-analyst), mr-reviewer (intent: n/a), debugger (нет ожидаемого - реконструкция-гипотеза вместо halt). discover не потребитель (технический инвентарь, оракул из кода не нужен). Замыкание - docs/superpowers/plans/2026-07-21-legacy-reconstruction-closure.md.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-07-15-oracle-closure.md
git commit -m "docs(plan): исправить ложную сноску потребителей legacy-reconstruction"
```

---

### Task 8: Финальная валидация

**Files:** нет правок - только прогон.

**Interfaces:**
- Consumes: всё из Task 1-7.
- Produces: подтверждение «0 ошибок» по всему валидатору + отсутствие drift.

- [ ] **Step 1: Полный прогон валидатора**

Run: `npm run validate`
Expected: PASS, 0 ошибок (agents/skills/commands/bundles), в т.ч. `bundle-not-closed` по пяти бандлам.

- [ ] **Step 2: Проверить hard-gate-терминалы во всех 4 слотах**

Run:
```bash
rg -n "скилл не грузится|не грузится|нет ТЗ|intent: n/a|реконструировано, не" \
  plugins/specialists/product/dex-business-analyst/agents/business-requirements-analyst.md \
  plugins/specialists/product/dex-requirements-analyst/agents/requirements-analyst.md \
  plugins/specialists/review/dex-mr-reviewer/agents/mr-reviewer.md \
  plugins/specialists/delivery/dex-debugger/agents/debugger.md
```
Expected: у каждого агента виден и «грузи при отсутствии ТЗ», и «есть ТЗ -> не грузится» (терминал закрыт с обеих сторон).

- [ ] **Step 3: Проверить, что скилл во всех 5 includes[]**

Run: `rg -l "dex-skill-legacy-reconstruction" plugins/bundles/*/bundle.json`
Expected: ровно 5 файлов (product-manager, system-analyst, code-review, dotnet-developer, dotnet-fullstack).

- [ ] **Step 4: Финальный commit (если валидатор что-то поправил) либо сводка**

Если Step 1 потребовал правок - закоммитить их; иначе перейти к созданию PR по git-workflow (base develop).

---

## Self-Review

**1. Spec coverage:**
- Спека «Целевые потребители» (4) -> Task 1-4 (по агенту). OK
- «Условие загрузки: hard gate» -> формулировка слота в каждом Task 1-4 Step 1 + проверка терминалов Task 8 Step 2. OK
- «Автономный случай: шаг 2 недоступен» -> статус «реконструировано, не согласовано» (ярлык тела скилла) в каждом слоте. OK
- «Риск закольцевания у debugger» -> Task 4 Step 2 (лог размыкает частично, гипотеза не success criteria). OK
- «Замыкание бандлов» (5) -> Task 5. OK
- «Правка плановой сноски» -> Task 7. OK
- «Что НЕ входит» (тело SKILL.md, новый узел, discover, requirements-reviewer/stand-reviewer) -> не порождает задач by design; ни одна задача их не трогает. OK
- «Версионирование» (4 агента + 5 бандлов minor, каталог без изменений) -> Task 1-5 bump plugin.json, Task 6 синхронизация marketplace, каталог не трогаем. OK
- «Проверки» -> Task 8. OK
- Gap: спека упоминает `sync-plugins.sh` в «Проверки» (drift после установки) - это пост-мердж локальная операция (установка обновлённых бандлов), не часть PR-правок репо. Оставлено за рамками плана намеренно (relates к «обнови плагины локально» после мерджа, не к содержанию PR).

**2. Placeholder scan:** нет TBD/TODO/«обработать edge cases» - все слоты приведены дословным текстом, все версии числовые, все команды исполнимы. OK

**3. Type consistency:** имя скилла везде `dex-skill-legacy-reconstruction:legacy-reconstruction` (полная форма); версии в bump-таблице Task 6 совпадают с Task 1-5 (2.3.0/1.5.0/1.9.0/2.2.0 агенты; 1.6.0/1.8.0/1.11.0/2.8.0/2.8.0 бандлы). OK
