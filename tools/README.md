# Tools

Dev-утилиты для Claude Code marketplace.

## validate-agent.js

Валидатор агентов, проверяющий соответствие [Agent Framework](../AGENT_FRAMEWORK.md).

### Что проверяет

**Frontmatter:**

- Обязательные поля `name`, `description`, `tools`
- Запрещённые поля `allowed-tools`, `skills` (skills загружаются императивно через Skill tool)
- Description короче 50 символов
- Description не содержит слов «Триггеры» / «trigger» — Claude Code матчит агентов по ключевым словам
- Отсутствие `Skill` в `tools:` — агент не сможет императивно загружать skills

**Phase-level:**

- Каждый агент должен иметь секции `## Phase N:`
- Каждая фаза должна иметь атрибут `**Goal:**`
- Каждая фаза должна иметь атрибут `**Exit criteria:**`
- Mandatory-фаза без обоснования (фреймворк требует объяснять «зачем mandatory»)
- Exit criteria содержит фразы из чёрного списка («агент понял», «анализ завершён») — они описывают внутреннее состояние, а не observable outcome
- Фаза содержит нумерованный список из ≥4 пунктов — потенциально процедурное описание (фреймворк требует декларативный стиль)

**Skill references:**

- Упомянутый в теле агента плагин `dex-skill-X` отсутствует в `marketplace.json`

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
npm run validate              # agents + skills + commands
npm run validate:agents       # только агенты
```

### Коды возврата

- `0` — чисто
- `1` — найдена хотя бы одна ошибка

### Как добавить новую проверку

1. Откройте `tools/validate-agent.js`
2. Найдите функцию `validateFrontmatter`, `validatePhases` или `validateSkillReferences` в зависимости от уровня проверки
3. Добавьте новое правило — push в `findings` с полями `level: ERROR`, `rule` (kebab-case идентификатор) и `message`
4. Прогоните `node tools/validate-agent.js all` чтобы убедиться, что правило не создаёт массовых false positives на существующих агентах
5. Обновите этот README с описанием нового правила

### Ограничения текущей версии

В первой версии не реализованы:

- Проверка output → input цепочки между фазами (требует семантического анализа)
- Проверка дублирования содержимого skills в теле агента (требует парсинга SKILL.md)
- Проверка соответствия `tools:` во frontmatter реально используемым tools в теле агента

Эти проверки — кандидаты для второй версии после того, как фреймворк стабилизируется на большем количестве мигрированных агентов.

## validate-skill.js

Валидатор skills, проверяющий соответствие [Skill Framework](../SKILL_FRAMEWORK.md).

### Что проверяет

- Обязательные frontmatter поля `name`, `description`
- Запрещённое поле `keywords`
- Description не содержит «Активируется при» / «Triggers» — единственный механизм автоматической активации
- Description короче 50 символов
- Description длиннее 250 символов (keywords за лимитом не активируют skill)
- Меньше 10 ключевых слов после «Активируется при»
- Размер файла > 500 строк (официальный лимит Claude Code)
- Размер файла > 150 строк (проектная рекомендация)
- Меньше 5 H3-секций (слишком мало ловушек)
- Fenced code block длиннее 5 строк (принцип «pointer, не код»)
- H3-ловушка без триады «Плохо / Правильно / Почему»
- Заголовки в стиле документации («Как настроить X», «Что такое Y», «Шаг N»)

### Запуск

```bash
# Один файл
node tools/validate-skill.js plugins/skills/dex-skill-ef-core/skills/ef-core/SKILL.md

# Все skills в plugins/skills/
node tools/validate-skill.js all
```

Через npm scripts:

```bash
npm run validate              # agents + skills + commands
npm run validate:skills       # только skills
```

### Коды возврата

- `0` — чисто
- `1` — найдена хотя бы одна ошибка

## validate-command.js

Валидатор команд, проверяющий соответствие [Command Framework](../docs/COMMAND_FRAMEWORK.md).

### Что проверяет

- Обязательное frontmatter поле `description`
- Размер файла > 200 строк (такой файл должен быть агентом, а не командой)
- Размер файла > 80 строк (проектная рекомендация)
- Нумерованный список ≥ 5 пунктов (процедурное описание вместо Goal + Output)
- Fenced code block длиннее 5 строк (команда описывает цель, а не содержит скрипты)
- ≥ 2 bash-блока суммарно > 10 строк (CLI-скрипты вместо декларативного описания)
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

- `0` — чисто
- `1` — найдена хотя бы одна ошибка

## validate-bundle.js

Валидатор замкнутости бандла: каждый бандл должен быть **целостным** — содержать в `includes[]` все скиллы, которые грузят его агенты.

### Зачем

Установка плоская: `install-bundle.sh` ставит ровно то, что перечислено в `includes[]`, каскада «специалист → его скиллы» нет. Скилл, который агент грузит через Skill tool, но которого нет в `includes[]`, не установится — агент молча деградирует (ветка graceful degradation). Валидатор ловит такой рассинхрон до коммита.

### Что проверяет

- **bundle-not-closed** (error) — агент из `includes[]` грузит не-by-stack скилл, которого нет в `includes[]`
- **include-not-in-marketplace** (error) — компонент `includes[]` не зарегистрирован в `marketplace.json` (иначе `install-bundle` упадёт)
- **empty-includes** (error) — у бандла нет `includes[]`
- **version-mismatch** (warning) — версия в `bundle.json` ≠ версии в `plugin.json`

**Исключение by-stack:** профильные скиллы со стек-префиксом (`dex-skill-{dotnet,ts,python,react,rabbitmq,kafka,…}-*`) не требуются в каждом бандле — языко-агностичные агенты грузят их условно по стеку проекта (см. `dex-skill-stack-registry`). Список префиксов — константа `BY_STACK_PREFIXES` в валидаторе.

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

- `0` — чисто
- `1` — найдена хотя бы одна ошибка
