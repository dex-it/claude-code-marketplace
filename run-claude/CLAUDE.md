# run-claude

Лаунчер Claude Code: читает локальную конфигурацию, поднимает окружение и запускает `claude` с нужными аргументами, промптом и MCP-серверами.

## Что делает `run-claude.sh`
1. Читает `.env` построчно (`КЛЮЧ=значение`), экспортирует в окружение.
2. Грузит системный промпт из `system-prompt.md` → `--append-system-prompt` (если `LOAD_SYSTEM_PROMPT=true`).
3. Регистрирует HTTP MCP-серверы, если заданы их `*_MCP_URL` + `*_MCP_TOKEN`.
4. `cd ..` и запускает `claude` с `CLAUDE_ARGS` + аргументами вызова.

`run-claude.ps1` — то же для Windows.

## Секреты — из менеджера, не в открытом виде
- В `.env` секрет задаётся подвыражением `$(...)`, которое скрипт раскрывает **только** для значений вида `$(`...`)`; обычные `КЛЮЧ=значение` идут как есть.
  - Linux/macOS (`run-claude.sh`): `SOME_API_KEY=$(pass show <path>)` — раскрытие через `eval`.
  - Windows (`run-claude.ps1`): `SOME_API_KEY=$(Get-Secret -Name <name> -AsPlainText)` — раскрытие через `Invoke-Expression` (PowerShell `SecretManagement` + `SecretStore`).
- `.env` — доверенный локальный файл (права `600` / per-user). `.env` под каждую ОС свой.
- `.mcp.json` ссылается на окружение через `${VAR}` — хардкода секретов нет. Claude Code поддерживает `${VAR}` и `${VAR:-default}`.

Новый секрет → клади в менеджер, в `.env` пиши `VAR=$(<вызов менеджера>)`, в `.mcp.json` ссылайся `${VAR}`. Хардкод секретов запрещён.

## Файлы
- `.env` — локальная конфигурация запуска (untracked, секреты через pass).
- `.mcp.json` — описание MCP-серверов, значения через `${VAR}`.
- `sample.env` — шаблон переменных.
- `settings.json` — настройки Claude Code.
- `system-prompt*.md` — варианты системного промпта.
