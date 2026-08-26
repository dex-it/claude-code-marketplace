# Реестр правил валидаторов

Каждое правило `tools/validate-*.js` - строка здесь. Правило без строки не проходит мета-проверку
`node tools/validate-rules-documented.js`: имя правила в выводе валидатора должно вести к норме, а не
к чтению кода. Обратное тоже проверяется - строка про несуществующее правило удаляется, иначе реестр
гниёт молча.

Колонка «Норма» - где живёт содержательное правило (почему так, а не иначе). Прочерк - правило
техническое либо самодостаточное: норму пересказывать негде и незачем.

<a id="регрессия-правил-фикстуры"></a>

## Регрессия правил: фикстуры

Каждая пара «валидатор x правило» несёт фикстуру - дерево, на котором правило обязано сработать.
Прогон - `npm test` (`tools/test-rules.js`). Без него правило проверено разово и выключается молча:
регулярка перестала матчить, ветка ушла под условие, порог разъехался. Живой каталог этого не
показывает - там правило и должно молчать.

Проба двусторонняя, вторая сторона общая: `tools/__fixtures__/_base` - дерево, дающее ноль находок
всеми валидаторами. Фикстура - оверлей поверх базы, то есть в песочнице ровно один внесённый дефект.
Правило, сработавшее без оверлея, валит проверку базы; правило, не сработавшее с оверлеем, валит
свою фикстуру. Валидатор переносится на песочницу переменной `MARKETPLACE_ROOT`.

```
tools/__fixtures__/_base/                        эталон нулевых находок
tools/__fixtures__/<validator>/<rule>/           оверлей поверх базы
tools/__fixtures__/<validator>/<rule>/expect.json   {"also": [], "messages": []} - опц.
```

Ожидание строгое: набор сработавших правил равен `{<rule>}` плюс перечисленное в `also`. Побочное
правило, не названное в `also`, - ошибка фикстуры: неучтённая побочка маскирует поломку соседнего
правила. `<validator>` - имя из `validate-<validator>.js`; пара, а не имя правила, потому что одно
имя (`read-failed`, `frontmatter-required`) эмитят несколько валидаторов, и фикстура у одного из них
ничего не говорит про остальные.

`messages` - подстроки, каждая обязана найтись хотя бы в одном сообщении находки. Имя правила одно
на все его шаблоны и все точки вызова, поэтому смерть одной из них множество имён не показывает:
соседи держат имя живым, и прогон остаётся зелёным. Различает их только текст сообщения. Правило с
несколькими шаблонами или несколькими точками вызова без `messages` покрыто частично.

Завёл или переименовал правило - заводится и фикстура; отсутствие ловит `rule-untested`.

## tools/validate-agent.js

| Правило | Уровень | Что ловит | Норма |
|---|---|---|---|
| `read-failed` | error | файл не читается или frontmatter не парсится | - |
| `frontmatter-required` | error | нет `name` / `description` / `tools` | [AGENT_FRAMEWORK.md](AGENT_FRAMEWORK.md#self-check-перед-коммитом) |
| `frontmatter-forbidden` | error | поле, ломающее агента (`allowed-tools`) | [AGENT_FRAMEWORK.md](AGENT_FRAMEWORK.md#self-check-перед-коммитом) |
| `frontmatter-description-short` | error | `description` короче порога - авто-активация не срабатывает | [AGENT_FRAMEWORK.md](AGENT_FRAMEWORK.md#self-check-перед-коммитом) |
| `frontmatter-description-long` | warning | `description` длиннее ориентира каталога | [AGENT_FRAMEWORK.md](AGENT_FRAMEWORK.md#self-check-перед-коммитом) |
| `frontmatter-description-too-long` | error | `description` за жёстким потолком | [AGENT_FRAMEWORK.md](AGENT_FRAMEWORK.md#self-check-перед-коммитом) |
| `frontmatter-description-no-triggers` | error | в `description` нет триггеров-симптомов - агент не находится по запросу | [AGENT_FRAMEWORK.md](AGENT_FRAMEWORK.md#self-check-перед-коммитом) |
| `frontmatter-model-missing` | error | нет явного `model` (наследование гонит механику на дорогой сессии) | [AGENT_FRAMEWORK.md](AGENT_FRAMEWORK.md#выбор-модели-model) |
| `frontmatter-model-invalid` | error | `model` не тир и не валидный ID | [AGENT_FRAMEWORK.md](AGENT_FRAMEWORK.md#выбор-модели-model) |
| `frontmatter-effort-invalid` | error | `effort` вне перечня уровней | [AGENT_FRAMEWORK.md](AGENT_FRAMEWORK.md#глубина-рассуждения-effort) |
| `frontmatter-effort-unsupported-model` | error | `effort` при модели, у которой этой оси нет | [AGENT_FRAMEWORK.md](AGENT_FRAMEWORK.md#глубина-рассуждения-effort) |
| `frontmatter-permissionmode-default` | error | `permissionMode: default` - избыточно | [AGENT_FRAMEWORK.md](AGENT_FRAMEWORK.md#self-check-перед-коммитом) |
| `frontmatter-no-skill-tool` | error | агент грузит skills, но `Skill` нет в `tools` | [AGENT_FRAMEWORK.md](AGENT_FRAMEWORK.md#подключение-skills-pre-load-безусловного-императив-условного) |
| `frontmatter-skills-bare-plugin-name` | error | `skills:` записан голым именем плагина - Claude Code молча пропускает | [AGENT_FRAMEWORK.md](AGENT_FRAMEWORK.md#подключение-skills-pre-load-безусловного-императив-условного) |
| `frontmatter-skills-unknown-skill` | error | плагин такого скилла не поставляет | [AGENT_FRAMEWORK.md](AGENT_FRAMEWORK.md#подключение-skills-pre-load-безусловного-императив-условного) |
| `frontmatter-skills-not-preloadable` | error | в `skills:` условный skill - его место в фазе, не в pre-load | [AGENT_FRAMEWORK.md](AGENT_FRAMEWORK.md#подключение-skills-pre-load-безусловного-императив-условного) |
| `frontmatter-skills-not-own-stage` | error | норматив этапа pre-load'ит не владелец этапа | [AGENT_FRAMEWORK.md](AGENT_FRAMEWORK.md#подключение-skills-pre-load-безусловного-императив-условного) |
| `stage-normative-reader-missing` | error | судящий агент над этапом не грузит норматив (судит состав по памяти) либо не несёт `Skill` в `tools` | [AGENT_FRAMEWORK.md](AGENT_FRAMEWORK.md#подключение-skills-pre-load-безусловного-императив-условного) |
| `factcheck-cascade-incomplete` | error | фаза fact-check есть, каскад `ToolSearch`+`WebSearch`+`WebFetch` неполон | [AGENT_FRAMEWORK.md](AGENT_FRAMEWORK.md#fact-verification-и-ответ-второй-стороны) |
| `judge-without-write` | error | агент пишет запись `quality-checks`, но в `tools` нет ни `Write`, ни `Edit` - вердикт не доходит до файла-метки | [AGENT_FRAMEWORK.md](AGENT_FRAMEWORK.md#tools-агента) |
| `agent-file-name-mismatch` | error | имя файла не совпадает с `name` | [CLAUDE.md](../CLAUDE.md) |
| `no-phases` | error | у агента нет ни одной `## Phase N` | [AGENT_FRAMEWORK.md](AGENT_FRAMEWORK.md) |
| `phase-missing-goal` | error | у фазы нет `**Goal:**` | [AGENT_FRAMEWORK.md](AGENT_FRAMEWORK.md) |
| `phase-missing-exit` | error | у фазы нет `**Exit criteria:**` | [AGENT_FRAMEWORK.md](AGENT_FRAMEWORK.md) |
| `phase-non-observable-exit` | error | exit criteria не наблюдаемы - выполнение фазы не проверяется | [AGENT_FRAMEWORK.md](AGENT_FRAMEWORK.md) |
| `phase-mandatory-no-justification` | error | mandatory-фаза без обоснования «почему mandatory» | [AGENT_FRAMEWORK.md](AGENT_FRAMEWORK.md) |
| `phase-procedural-body` | error | тело фазы - процедура (команды, код), а не контракт | [AGENT_FRAMEWORK.md](AGENT_FRAMEWORK.md) |
| `glued-attribute-block` | error | атрибут фазы слипся с предыдущим блоком - markdown сливает их в абзац | [AGENT_FRAMEWORK.md](AGENT_FRAMEWORK.md#self-check-перед-коммитом) |
| `skill-reference-unknown` | error | ссылка на skill-плагин, которого нет в `marketplace.json` | [plugin-changes.md](../.claude/rules/plugin-changes.md) |
| `catalog-docs-link` | error | тело артефакта ссылается на `docs/` каталога - URL `blob/main/docs/...` либо относительный markdown-линк. `docs/` нормирует авторство и в установленный плагин не входит: адрес выглядит валидным, а исполнитель его не откроет. Норма живёт в самом артефакте либо в установленном скилле | [CLAUDE.md](../CLAUDE.md) |
| `link-escapes-plugin` | error | ссылка из тела выводит за корень плагина (`](../<сосед>/...)`) - соседний плагин ставится у пользователя сам по себе, путь в рантайме не резолвится. Подъём внутри своего плагина законен и правилом не трогается: решает разрешённый путь, а не число `../`. Сосед называется формой `{plugin}:{skill}` | [CLAUDE.md](../CLAUDE.md) |

## tools/validate-skill.js

| Правило | Уровень | Что ловит | Норма |
|---|---|---|---|
| `read-failed` | error | файл не читается или frontmatter не парсится | - |
| `frontmatter-required` | error | нет обязательных полей skill | [SKILL_FRAMEWORK.md](SKILL_FRAMEWORK.md) |
| `frontmatter-forbidden` | error | поле вне перечня валидных (`keywords` и подобные) | [SKILL_FRAMEWORK.md](SKILL_FRAMEWORK.md) |
| `description-short` | error | `description` короче порога | [SKILL_FRAMEWORK.md](SKILL_FRAMEWORK.md) |
| `description-long` | warning | `description` длиннее ориентира каталога | [SKILL_FRAMEWORK.md](SKILL_FRAMEWORK.md) |
| `description-too-long` | error | `description` за жёстким потолком каталога | [SKILL_FRAMEWORK.md](SKILL_FRAMEWORK.md) |
| `description-exceeds-claude-limit` | error | `description` за лимитом платформы - обрезается молча | [SKILL_FRAMEWORK.md](SKILL_FRAMEWORK.md) |
| `description-no-activation` | error / warning у process | в `description` нет ключевых слов активации | [SKILL_FRAMEWORK.md](SKILL_FRAMEWORK.md) |
| `description-few-keywords` | error / warning у process | ключевых слов слишком мало для срабатывания | [SKILL_FRAMEWORK.md](SKILL_FRAMEWORK.md) |
| `documentation-style-title` | error | skill оформлен как документация API, а не как каталог ловушек | [SKILL_FRAMEWORK.md](SKILL_FRAMEWORK.md) |
| `too-few-traps` | error | ловушек меньше минимума; у process-skill не проверяется | [SKILL_FRAMEWORK.md](SKILL_FRAMEWORK.md) |
| `trap-missing-triad` | error | ловушка без триады «Плохо / Правильно / Почему»; у process-skill не проверяется | [SKILL_FRAMEWORK.md](SKILL_FRAMEWORK.md) |
| `process-empty` | error | process-skill без содержания правила - ни таблицы-реестра, ни разделов | [SKILL_FRAMEWORK.md](SKILL_FRAMEWORK.md) |
| `code-fence-too-long` | error | блок кода длиннее допустимого - skill сползает в документацию | [SKILL_FRAMEWORK.md](SKILL_FRAMEWORK.md) |
| `size-exceeds-recommended` | error | размер выше проектного потолка trap-skill; у process-skill не проверяется - он от этого порога освобождён | [SKILL_FRAMEWORK.md](SKILL_FRAMEWORK.md) |
| `size-exceeds-hard-limit` | error | размер за рекомендацией Anthropic; действует для обоих типов skill | [SKILL_FRAMEWORK.md](SKILL_FRAMEWORK.md) |
| `chars-exceed-hard-limit` | error | размер в символах выше `CHARS_HARD_LIMIT`; вторая мера того же ограничения - плотность строки в каталоге различается кратно, поэтому строчный потолок расход окна почти не ограничивает; замер и его дата - в `SKILL_FRAMEWORK.md`, здесь не дублируются | [SKILL_FRAMEWORK.md](SKILL_FRAMEWORK.md) |
| `chars-exceed-recommended` | warning | размер в символах выше `CHARS_RECOMMENDED_MAX` - предупреждение до жёсткого потолка, чтобы носитель резали до того, как он упрётся | [SKILL_FRAMEWORK.md](SKILL_FRAMEWORK.md) |
| `reference-chars-exceed-recommended` | warning | файл `references/` выше `CHARS_RECOMMENDED_MAX`. В счёт тела не идёт и жёсткого потолка не имеет: мера предупреждающая, предъявляется на ревью, мерджа не блокирует | [SKILL_FRAMEWORK.md](SKILL_FRAMEWORK.md) |
| `reference-dir-chars-exceed-recommended` | warning | сумма символов всех файлов `references/` выше того же `CHARS_RECOMMENDED_MAX`. Пофайловая мера обходится разбиением - тот же материал в двух файлах молчит, а цена чтения лежит на директории. Своего числа у суммы нет, порог заимствован у тела | [SKILL_FRAMEWORK.md](SKILL_FRAMEWORK.md) |
| `catalog-docs-link` | error | тело скилла или файл его `references/` ссылается на `docs/` каталога - URL `blob/main/docs/...` либо относительный markdown-линк. `docs/` нормирует авторство и в установленный плагин не входит: адрес выглядит валидным, а исполнитель его не откроет. Норма живёт в самом артефакте либо в установленном скилле | [CLAUDE.md](../CLAUDE.md) |
| `link-escapes-plugin` | error | ссылка из тела выводит за корень плагина (`](../<сосед>/...)`) - соседний плагин ставится у пользователя сам по себе, путь в рантайме не резолвится. Подъём внутри своего плагина законен и правилом не трогается: решает разрешённый путь, а не число `../`. Сосед называется формой `{plugin}:{skill}` | [CLAUDE.md](../CLAUDE.md) |
| `orchestrator-unregistered` | error | skill любого типа похож на спавн/делегирование агенту (глагол делегирования рядом с бэктик-ссылкой на агента/`Agent` в одном блоке), но не в `ORCHESTRATOR_SKILLS`. Эвристика best-effort, не исчерпывающая, и ошибается в обе стороны. Известные пропуски: делегирование без имени агента в тексте, глаголы вне словаря, короткое имя агента без `dex-plugin:`-префикса. Известное ложное срабатывание: ссылка на **скилл** формой `плагин:скилл` неотличима от ссылки на агента - префикс `dex-skill-` исключён из шаблона (агентов в этих плагинах нет ни одного), но плагин со скиллами вне этого префикса снова даст ложное | [SKILL_FRAMEWORK.md](SKILL_FRAMEWORK.md#норма-каталога-оркестрация---в-скилле-исполнение---в-агенте) |

Тип skill - ось калибровки: `process` опознаётся по allowlist `PROCESS_SKILLS` в самом валидаторе,
маркер в теле файла не парсится. Пороги, полная таблица различий и обоснование -
[SKILL_FRAMEWORK.md](SKILL_FRAMEWORK.md) («Калибровка валидатора по типу»), здесь не дублируем.

## tools/validate-command.js

| Правило | Уровень | Что ловит | Норма |
|---|---|---|---|
| `read-failed` | error | файл не читается или frontmatter не парсится | - |
| `frontmatter-required` | error | нет обязательных полей команды | [COMMAND_FRAMEWORK.md](COMMAND_FRAMEWORK.md) |
| `documentation-style-title` | error | команда оформлена как документация | [COMMAND_FRAMEWORK.md](COMMAND_FRAMEWORK.md) |
| `bash-script-detected` | error | тело команды - bash-скрипт, а не Goal + Output format | [COMMAND_FRAMEWORK.md](COMMAND_FRAMEWORK.md) |
| `procedural-body` | error | тело - процедура вместо точечного действия | [COMMAND_FRAMEWORK.md](COMMAND_FRAMEWORK.md) |
| `code-fence-too-long` | error | блок кода длиннее допустимого | [COMMAND_FRAMEWORK.md](COMMAND_FRAMEWORK.md) |
| `size-exceeds-recommended` | error | размер выше целевого | [COMMAND_FRAMEWORK.md](COMMAND_FRAMEWORK.md) |
| `size-exceeds-hard-limit` | error | размер за жёстким потолком | [COMMAND_FRAMEWORK.md](COMMAND_FRAMEWORK.md) |
| `skill-reference-unknown` | error | ссылка `` `{plugin}:{skill}` `` в теле - плагин такого скилла не поставляет (обе половины проверяются, не только плагин) | [plugin-changes.md](../.claude/rules/plugin-changes.md) |
| `catalog-docs-link` | error | тело артефакта ссылается на `docs/` каталога - URL `blob/main/docs/...` либо относительный markdown-линк. `docs/` нормирует авторство и в установленный плагин не входит: адрес выглядит валидным, а исполнитель его не откроет. Норма живёт в самом артефакте либо в установленном скилле | [CLAUDE.md](../CLAUDE.md) |
| `link-escapes-plugin` | error | ссылка из тела выводит за корень плагина (`](../<сосед>/...)`) - соседний плагин ставится у пользователя сам по себе, путь в рантайме не резолвится. Подъём внутри своего плагина законен и правилом не трогается: решает разрешённый путь, а не число `../`. Сосед называется формой `{plugin}:{skill}` | [CLAUDE.md](../CLAUDE.md) |

## tools/validate-bundle.js

| Правило | Уровень | Что ловит | Норма |
|---|---|---|---|
| `read-failed` | error | `bundle.json` не парсится | - |
| `empty-includes` | error | `includes[]` пуст - ставить нечего | [plugin-changes.md](../.claude/rules/plugin-changes.md) |
| `include-not-in-marketplace` | error | запись `includes[]` отсутствует в `marketplace.json` - установка упадёт | [plugin-changes.md](../.claude/rules/plugin-changes.md) |
| `bundle-not-closed` | error | агент бандла грузит скилл, которого нет в `includes[]` - установка плоская, агент молча деградирует | [plugin-changes.md](../.claude/rules/plugin-changes.md) |
| `bundle-agent-not-closed` | error | скилл бандла делегирует специалисту (`` `dex-X:Y` ``, `X` != `dex-skill-*`), которого нет в `includes[]` - зеркало `bundle-not-closed` в обратную сторону, делегированию не к кому обратиться | [plugin-changes.md](../.claude/rules/plugin-changes.md) |
| `bundle-command-not-closed` | error | команда бандла называет скилл или специалиста (`` `dex-X:Y` ``), которого нет в `includes[]` - третье ребро замыкания: команда приезжает со своим плагином и появляется в меню, а названный исполнитель нет, имя не резолвится молча. Ловится только форма `plugin:name`; голое имя плагина в прозе правило не поднимает |
| `version-mismatch` | warning | версия в `plugin.json` != версии в `marketplace.json`; охват - каждый плагин под `plugins/`, не только бандлы | [plugin-changes.md](../.claude/rules/plugin-changes.md) |
| `description-mismatch` | error | описание в `plugin.json` != описанию в записи `marketplace.json`; дом описания - `plugin.json`, каталожная копия генерируется `npm run sync:marketplace` и руками не пишется | [plugin-changes.md](../.claude/rules/plugin-changes.md) |
| `description-not-russian` | warning | витрина в `plugin.json` без единого кириллического символа - каталог русскоязычный, разноязычная витрина читается вперемешку в `/plugin`. Текст витрины пишется по телу артефакта, а не переводом поля активации | [plugin-changes.md](../.claude/rules/plugin-changes.md) |

## tools/validate-rules-documented.js

| Правило | Уровень | Что ловит | Норма |
|---|---|---|---|
| `rule-not-documented` | error | правило есть в коде валидатора, строки в этом реестре нет | этот файл |
| `rule-registry-stale` | error | строка в реестре есть, правила в коде нет | этот файл |
| `rule-untested` | error | у пары «валидатор x правило» нет фикстуры в `tools/__fixtures__` | [VALIDATOR_RULES.md](#регрессия-правил-фикстуры) |
