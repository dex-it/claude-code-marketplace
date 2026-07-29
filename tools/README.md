# Tools

Dev-утилиты для Claude Code marketplace.

Этот файл описывает, **что** ловят валидаторы: правила, их идентификаторы, уровни и механизмы отбора. **Числовые пороги здесь не дублируются** - у них есть нормативные дома, и копия числа расходится молча (именно так этот README и разошёлся с кодом). Дом порогов skill - [SKILL_FRAMEWORK.md](../docs/SKILL_FRAMEWORK.md) («Лимиты (валидатор)» и «Размер skill»), дом порогов команды - [COMMAND_FRAMEWORK.md](../docs/COMMAND_FRAMEWORK.md) («Размер»); в обоих числа парны константам валидатора и правятся одним коммитом с ними. Пороги агента дома пока не имеют и названы здесь. Поведение правил проверено зондом: артефакт-пример ставился ровно на границу и прогонялся.

## validate-agent.js

Валидатор агентов, проверяющий соответствие [Agent Framework](../AGENT_FRAMEWORK.md).

### Что проверяет

Список перечисляет нарушения, которые валидатор ловит. Уровень указан у каждого; где не указано - ERROR.

**Frontmatter:**

- Отсутствие обязательного поля `name`, `description`, `tools` или `model`
- Запрещённое поле `allowed-tools` (для доступа к инструментам есть `tools:`)
- Поле `skills:` со значением, отличным от `node-contract` (правило `frontmatter-skills-not-preloadable`). Само поле не запрещено: pre-load разрешён ровно одному безусловному process-skill, и обе полные формы записи проходят - `node-contract` и `dex-skill-node-contract:node-contract`. Прочие скиллы грузятся императивно через Skill tool в фазах. Список разрешённых к pre-load - константа `ALLOWED_PRELOAD_SKILLS` в валидаторе
- Значение `skills:` в виде голого имени плагина, без скилла (правило `frontmatter-skills-bare-plugin-name`): `dex-skill-node-contract` не резолвится, плагин молча пропускается
- Значение `skills:` с неизвестным именем скилла при известном плагине (правило `frontmatter-skills-unknown-skill`). Обратный случай не ловится ничем: опечатка в половине-плагине (`dex-skill-nodecontract:node-contract`) даёт ноль ошибок, потому что нормализация берёт часть после последнего `:`, а неизвестный плагин объявлен вне области проверки. Зонд: правка половины-плагина - 0 ошибок, правка половины-скилла - 2
- Имя файла не совпадает с полем `name` (правило `agent-file-name-mismatch`; сравнивается basename без `.md`)
- Description короче 50 символов
- Description длиннее 500 символов - WARNING; длиннее 750 - ERROR. Верхнего яруса под платформенный лимит у агентов нет
- Значение `model` вне набора `opus` / `sonnet` / `haiku` / `fable` / `inherit` или полного идентификатора модели (правило `frontmatter-model-invalid`). Само значение `inherit` валидатор пропускает, хотя фреймворк требует явный тир
- Значение `effort` вне набора `low` / `medium` / `high` / `xhigh` / `max` (`frontmatter-effort-invalid`), а также `effort` при `model: haiku` (`frontmatter-effort-unsupported-model`: у этого тира оси effort нет)
- Избыточное `permissionMode: default` (`frontmatter-permissionmode-default`)
- Неполный каскад под fact-check (`factcheck-cascade-incomplete`): тело зовёт `dex-skill-fact-verification:fact-verification`, а в `tools` нет `ToolSearch`, `WebSearch` или `WebFetch`
- Description не содержит слов «Триггеры» / «trigger» - Claude Code матчит агентов по ключевым словам
- Отсутствие `Skill` в `tools:` - агент не сможет императивно загружать skills

Ограничения на размер файла агента валидатор не накладывает.

**Phase-level:**

- Каждый агент должен иметь секции `## Phase N:`
- Каждая фаза должна иметь атрибут `**Goal:**`
- Каждая фаза должна иметь атрибут `**Exit criteria:**`
- Mandatory-фаза без обоснования (фреймворк требует объяснять «зачем mandatory»). Правило смотрит не на наличие продолжения, а на его длину: хвост после `yes` короче 10 символов после trim - ERROR. Зонд: `yes - abcdefg` (9 символов) падает, `yes - abcdefgh` (10) проходит, то есть отговорка в пару слов не засчитывается
- Exit criteria содержит фразы из чёрного списка («агент понял», «анализ завершён») - они описывают внутреннее состояние, а не observable outcome
- Фаза содержит нумерованный список из >=4 пунктов - потенциально процедурное описание (фреймворк требует декларативный стиль)

**Skill references:**

- Упомянутый в теле агента плагин `dex-skill-X` отсутствует в `marketplace.json`. Правило видит только закрытую форму в бэктиках `` `dex-skill-X:skill` ``: голое `dex-skill-X` без имени скилла под проверку не попадает вовсе (не «падает», а остаётся невидимым). Существование самого скилла внутри плагина не проверяется

### Установка

Из корня репозитория:

```bash
npm install
```

Устанавливает dev-зависимости: `remark`, `gray-matter`, `unist-util-visit`. Папка `node_modules` игнорируется git, `package-lock.json` коммитится.

### Запуск

```bash
# Один файл
node tools/validate-agent.js plugins/specialists/dotnet/dex-dotnet-coder/agents/dotnet-coder.md

# Все агенты в plugins/specialists/
node tools/validate-agent.js all
```

Через npm scripts:

```bash
npm run validate              # agents + skills + commands + bundles
npm run validate:agents       # только агенты
```

### Коды возврата

- `0` - чисто
- `1` - найдена хотя бы одна ошибка

### Как добавить новую проверку

1. Откройте `tools/validate-agent.js`
2. Найдите функцию `validateFrontmatter`, `validatePhases` или `validateSkillReferences` в зависимости от уровня проверки
3. Добавьте новое правило - push в `findings` с полями `level: ERROR`, `rule` (kebab-case идентификатор) и `message`
4. Прогоните `node tools/validate-agent.js all` чтобы убедиться, что правило не создаёт массовых false positives на существующих агентах
5. Обновите этот README с описанием нового правила - и порог тоже, если правило его вводит

### Ограничения текущей версии

В первой версии не реализованы:

- Проверка output -> input цепочки между фазами (требует семантического анализа)
- Проверка дублирования содержимого skills в теле агента (требует парсинга SKILL.md)
- Проверка соответствия `tools:` во frontmatter реально используемым tools в теле агента

Эти проверки - кандидаты для второй версии после того, как фреймворк стабилизируется на большем количестве мигрированных агентов.

## validate-skill.js

Валидатор skills, проверяющий соответствие [Skill Framework](../SKILL_FRAMEWORK.md).

### Что проверяет

Уровень указан у каждого пункта; где не указано - ERROR. Числа порогов - в [SKILL_FRAMEWORK.md](../docs/SKILL_FRAMEWORK.md), разделы «Лимиты (валидатор)» и «Размер skill».

- Отсутствие обязательного frontmatter поля `name` или `description`
- Запрещённое поле `keywords` (не поддерживается Claude Code для skills)
- Description не содержит «Активируется при» / «Triggers» - единственный механизм автоматической активации
- Description короче 50 символов
- Description длиннее мягкого порога - WARNING (`description-long`), длиннее проектного потолка - ERROR (`description-too-long`), длиннее хард-лимита Claude Code - ERROR (`description-exceeds-claude-limit`). Ярусы взаимоисключающие. **Важный зазор:** хард-лимит платформы действует на **сумму** `description` и `when_to_use`, а валидатор меряет только `description` - сумму не проверяет никто, и скилл может пройти прогон, но быть обрезан в листинге
- Меньше порогового числа ключевых слов после «Активируется при» - ERROR у обычного скилла, WARNING у process-skill
- Размер файла выше проектной рекомендации - ERROR (`size-exceeds-recommended`)
- Размер файла выше рекомендации Anthropic «keep SKILL.md under 500 lines» - ERROR (`size-exceeds-hard-limit`). Это рекомендация, а не платформенное усечение
- Меньше 5 H3-секций (слишком мало ловушек)
- Fenced code block длиннее потолка (принцип «pointer, не код»)
- H3-ловушка без триады «Плохо / Правильно / Почему»
- Заголовки в стиле документации («Как настроить X», «Что такое Y», «Шаг N»)

**Вторая ось: process-skill.** Скилл, кодирующий процесс, а не ловушки стека, живёт по другим порогам. Опознаётся по полю `name` во frontmatter (не по пути и не по каталогу), список имён - константа в валидаторе. Для такого скилла:

- порог размера свой, выше обычного, а рекомендация Anthropic не применяется вовсе
- проверка «меньше 5 H3-секций» не применяется - у процесса ловушек нет
- вместо неё работает `process-empty`: реестровая таблица либо минимум две H2-секции с правилами. Иначе скилл считается заглушкой, эксплуатирующей освобождение от ловушек
- отсутствие фразы активации в `description` понижено до WARNING (`description-no-activation`), как и нехватка ключевых слов

### Запуск

```bash
# Один файл
node tools/validate-skill.js plugins/skills/dex-skill-ef-core/skills/ef-core/SKILL.md

# Все skills в plugins/skills/
node tools/validate-skill.js all
```

Через npm scripts:

```bash
npm run validate              # agents + skills + commands + bundles
npm run validate:skills       # только skills
```

### Коды возврата

- `0` - чисто
- `1` - найдена хотя бы одна ошибка

## validate-command.js

Валидатор команд, проверяющий соответствие [Command Framework](../docs/COMMAND_FRAMEWORK.md).

### Что проверяет

Все правила этого валидатора - уровня ERROR. Числа порогов - в [COMMAND_FRAMEWORK.md](../docs/COMMAND_FRAMEWORK.md), раздел «Размер».

- Отсутствие обязательного frontmatter поля `description`
- Размер файла выше жёсткого потолка (`size-exceeds-hard-limit`, вердикт «это должен быть агент с фазами»). Исключений у этого порога нет
- Размер файла выше потолка точечной команды (`size-exceeds-recommended`). Для команд из allowlist `PIPELINE_COMMANDS` порог поднят, жёсткий потолок при этом не двигается. Allowlist сверяется по точному basename файла
- Нумерованный список >= 5 пунктов (процедурное описание вместо Goal + Output)
- Fenced code block длиннее потолка (команда описывает цель, а не содержит скрипты)
- Два и более bash-блока суммарной длиной выше порога (CLI-скрипты вместо декларативного описания). В счёт идут блоки с языком `bash`, `sh` или `shell`; блоки в 3 строки и короче отбрасываются и в сумму не входят, прочие языки не считаются вовсе
- Заголовки в стиле документации («Как настроить X», «Что такое Y», «Шаг N»)

### Запуск

```bash
# Один файл
node tools/validate-command.js plugins/specialists/dotnet/dex-dotnet-coder/commands/build.md

# Все команды в plugins/
node tools/validate-command.js all
```

Через npm scripts:

```bash
npm run validate              # agents + skills + commands + bundles
npm run validate:commands     # только команды
```

### Коды возврата

- `0` - чисто
- `1` - найдена хотя бы одна ошибка

## validate-bundle.js

Валидатор замкнутости бандла: каждый бандл должен быть **целостным** - содержать в `includes[]` все скиллы, которые грузят его агенты.

**Этот валидатор не входит в CI.** Workflow `.github/workflows/validate-agents.yml` вызывает три валидатора из четырёх - агентов, скиллы и команды. Замкнутость бандла гейтит только локальный прогон `npm run validate`, поэтому незамкнутый бандл в PR проверкой не остановится.

### Зачем

Установка плоская: `install-bundle.sh` ставит ровно то, что перечислено в `includes[]`, каскада «специалист -> его скиллы» нет. Скилл, который агент грузит через Skill tool, но которого нет в `includes[]`, не установится - агент молча деградирует (ветка graceful degradation). Валидатор ловит такой рассинхрон до коммита.

### Что проверяет

- **bundle-not-closed** (error) - агент из `includes[]` грузит скилл, которого нет в `includes[]` (с поправкой на by-stack ниже)
- **include-not-in-marketplace** (error) - компонент `includes[]` не зарегистрирован в `marketplace.json` (иначе `install-bundle` упадёт)
- **empty-includes** (error) - у бандла нет `includes[]`
- **version-mismatch** (warning) - версия в `plugin.json` бандла не равна версии этого бандла в `marketplace.json` (реальная двухместная синхронизация; в `bundle.json` версии нет)

**Исключение by-stack:** профильные скиллы со стек-префиксом (`dex-skill-{dotnet,ts,python,react,rabbitmq,kafka,...}-*`) exempt, только пока бандл не везёт ни одного скилла этого стека: языко-агностичные агенты грузят их условно по стеку проекта (см. `dex-skill-stack-registry`), и они приезжают по тому, что установил пользователь. Как только бандл закоммитился на стек (уже содержит хотя бы один скилл этого стека), он считается стековым и обязан быть замкнут и по этому стеку, иначе его стек-специфичный агент (например `dex-dotnet-coder`) молча деградирует. Список префиксов - константа `BY_STACK_PREFIXES` в валидаторе.

### Запуск

```bash
# Один бандл (по имени, директории или пути к bundle.json)
node tools/validate-bundle.js dex-bundle-architect

# Все бандлы
node tools/validate-bundle.js all
```

Через npm scripts:

```bash
npm run validate              # agents + skills + commands + bundles
npm run validate:bundles      # только бандлы
```

### Коды возврата

- `0` - чисто
- `1` - найдена хотя бы одна ошибка
