# Механизмы расширения Claude Code: command hook, мод, Agent SDK

Справка для выбора механизма, не норматив: устройство мода в каталоге - [MOD_FRAMEWORK.md](MOD_FRAMEWORK.md), утилиты - [CLI_UTILITIES.md](CLI_UTILITIES.md).

Источники (сверено 04.10.2026, Claude Code 2.1.289):

- мод - контракт типов `mods/types/claude-code.d.ts` (записан `/plugin-types` на 2.1.272) и источники из [MOD_FRAMEWORK.md](MOD_FRAMEWORK.md);
- Agent SDK - справочник [TypeScript SDK](https://code.claude.com/docs/en/agent-sdk/typescript.md) (опции `Options`, методы `Query`), [hooks](https://code.claude.com/docs/en/agent-sdk/hooks.md), [custom tools](https://code.claude.com/docs/en/agent-sdk/custom-tools.md), [sessions](https://code.claude.com/docs/en/agent-sdk/sessions.md).

API модов в раннем доступе и меняется между релизами без предупреждения: перед опорой на строку таблицы сверить её с текущим `claude-code.d.ts`.

## Суть различия

- **Command hook** реагирует на событие из отдельного процесса оболочки: JSON на stdin, ответ в stdout или кодом выхода.
- **Мод** работает внутри процесса Claude Code и встраивается в интерактивную сессию человека: ввод, промпт, ход модели, инструменты, интерфейс.
- **Agent SDK** ведёт Claude Code снаружи как библиотеку в твоём процессе: прогоны без человека, свой интерфейс или его отсутствие.

## Сравнение

| Возможность | Command hook | Мод (function hooks) | Agent SDK |
| --- | --- | --- | --- |
| Носитель | `hooks/hooks.json`, ключ `hooks` | `hooks/hooks.json`, ключ `modules` + TypeScript | пакет TS / Python в твоём приложении |
| Где исполняется | процесс оболочки на событие | процесс Claude Code | твой процесс |
| Кто ведёт сессию | человек | человек, мод встраивается | твой код: `query()`, ввод через `streamInput` |
| Интерфейс Claude Code | текст в транскрипт или в контекст | панели, строки, тосты, кнопки, перерисовка любого компонента (`ui.render`) | нет, свой |
| Перехват инструмента | `PreToolUse`: запрет, правка входа | `tool.call`: запрет или ответ вместо инструмента | хук `PreToolUse`: запрет, `updatedInput` |
| Решение о разрешении | `PreToolUse` / `PermissionRequest` | `tool.check`, полный вердикт | `canUseTool` (только когда дошло бы до вопроса), `setPermissionMode()` |
| Свои tools | нет | `$.tool.register` | in-process MCP: `createSdkMcpServer()` + `tool()` |
| Свои команды | нет | `command.run`, `$.command.register` | нет, из установленных плагинов |
| Системный промпт | нет | `prompt.section` / `prompt.context`, на лету | `systemPrompt`: свой или preset `claude_code` + `append`, при старте |
| Ввод пользователя | `UserPromptSubmit`: блок, `additionalContext` | `prompt.submit` / `prompt.fill` / `prompt.suggest`: переписать, подставить, подсказать | ввод формирует код; хук `UserPromptSubmit` |
| Ход модели | `Stop` после хода | `turn.step` потоком, `turn.start` / `turn.complete`, `$.turn.abort` | поток сообщений итератора, `interrupt()`, `abortController` |
| Вызов модели сбоку | нет | `$.model.complete` / `classify` / `fork` | нет, отдельный Anthropic API |
| Субагенты | `SubagentStart` / `SubagentStop` | `$.agent.spawn`, перехват чужих (`agent.spawn`) | опция `agents`, `stopTask()`, `supportedAgents()` |
| Состояние | нет, только файлы | `$.store`, таймеры `$.clock` (`after`, `every`) на сессию | твоё приложение; `resume`, `forkSession`, `rewindFiles()` |
| Плагины и настройки | часть плагина | сам плагин | `plugins`, `settingSources`, `reloadPlugins()`, `setModel()`, `setMcpServers()` |
| Внешний мир | любой, это процесс оболочки | через эффекты: `$.process.run`, `$.http.fetch`, `$.fs`, `$.mcp` | любой, это твой процесс |
| Статус | стабильно | ранний доступ, `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` | стабильное публичное API |
| Цена ошибки | срывается один вызов | падает сессия пользователя | падает твоё приложение |

## Когда что

- **Command hook** - хватает «событие -> скрипт -> текст или блок»: линтер после правки, запрет команды, уведомление. Проще всех и не ломается от релиза к релизу.
- **Мод** - менять поведение и интерфейс самого Claude Code в интерактивной сессии: живые панели, перехват с логикой, состояние на сессию, свои команды и tools. Классические события мод тоже видит (`classic.*`), поэтому покрывает command hook целиком - ценой нестабильного API.
- **Agent SDK** - Claude Code как часть продукта: CI-бот, сервис, своё приложение, пакетные прогоны. Хуки и свои tools есть, но в чужой интерфейс SDK не встраивается.

Общее у мода и SDK: перехват инструментов, свои tools, контроль разрешений, субагенты. Только у мода: интерфейс, перехват ввода, правка промпта посреди сессии, вызов модели сбоку. Только у SDK: работа без человека, стабильное API, полный контроль процесса.
