# run-claude

Лаунчер Claude Code: читает локальную конфигурацию, поднимает окружение и запускает `claude` с нужными аргументами и промптом. MCP-серверы он не регистрирует - это разовый отдельный шаг (соседний `register-http-mcp.sh` / `.ps1` для HTTP, `.mcp.json` для stdio). Порядок шагов и список переменных - в самих `run-claude.sh` и `run-claude.ps1` (Windows), инструкция для человека - `README.md`. Здесь только то, что из кода не видно сразу.

## Промпт: лаунчер читает ровно один файл

Оба скрипта читают `./system-prompt.md` и передают его через `--append-system-prompt`; выбора файла по роли у них нет. `system-prompt-plugin.md` и `system-prompt-sysadmin.md` - варианты, которые подставляются вручную (копией в `system-prompt.md`), поэтому правка варианта сама по себе на запуск не влияет. Загрузка промпта отключается `LOAD_SYSTEM_PROMPT=false` в `.env`.

## Секреты - из менеджера, не в открытом виде

- В `.env` секрет задаётся значением ровно одной из двух форм; обычные `КЛЮЧ=значение` идут как есть, любое иное `$(...)` в значении берётся литералом с предупреждением и не исполняется. Значение перед разбором режется одинаково в лаунчере и регистраторе: пробелы по краям, затем обрамляющие кавычки (`$(pass show "x")` и `$(pass  show x)` - литералы в обоих).
  - Linux/macOS (`run-claude.sh`, `register-http-mcp.sh`): `SOME_API_KEY=$(pass show <path>)` - разбор регуляркой, вызов `pass show` напрямую без `eval`; берётся первая строка записи (по соглашению `pass` там пароль, ниже `login:` и поля).
  - Windows (`run-claude.ps1`, `register-http-mcp.ps1`): `SOME_API_KEY=$(Get-Secret -Name <name> -AsPlainText)` - разбор регуляркой, вызов `Get-Secret` напрямую без `Invoke-Expression` (PowerShell `SecretManagement` + `SecretStore`).
  - `<path>` / `<name>` - `[A-Za-z0-9_./-]`, не с дефиса. Разбор в лаунчере и регистраторе один и тот же (`trim_env_value` / `Format-EnvValue`, `env_key_allowed` / `Test-EnvKey`, `resolve_env_secret` / `Resolve-EnvSecret`); правя одну пару, правь обе (тест `tests/tools/run-claude-secret.test.sh` сверяет тексты функций, в том числе обеих ps1).
- Исполнить код может и имя переменной (`BASH_ENV=$(...)` срабатывает при старте любого bash-скрипта, в том числе `pass`; так же `GIT_CONFIG_*`, `LD_PRELOAD`, `NODE_OPTIONS`, `PATH`). Поэтому имя проверяется до разбора значения: допустимо `[A-Za-z_][A-Za-z0-9_]*`, а `BASH_ENV`, `ENV`, `PS4`, `PROMPT_COMMAND`, `SHELLOPTS`, `BASHOPTS`, `PATH`, `NODE_OPTIONS`, `LD_*`, `DYLD_*`, `GIT_CONFIG_*`, `GIT_SSH*`, `GIT_*PAGER`, `GIT_EXTERNAL_DIFF`, `GIT_ASKPASS`, `GIT_EDITOR` (в ps1 ещё `PSModulePath`) отбрасываются с предупреждением. Нужна такая переменная - задай её в shell.
- `.env` - локальный untracked файл (права `600` / per-user), свой под каждую ОС. Значения-подвыражения он не исполняет, а имена из списка выше не экспортирует; подставленное значение берётся из менеджера, поэтому чужой `.env` не подкладываем.
- `.mcp.json` ссылается на окружение через `${VAR}` - хардкода секретов нет. Claude Code поддерживает `${VAR}` и `${VAR:-default}`.

Новый секрет -> клади в менеджер, в `.env` пиши `VAR=$(pass show <путь>)` (Linux/macOS) или `VAR=$(Get-Secret -Name <имя> -AsPlainText)` (Windows), в `.mcp.json` ссылайся `${VAR}`. Хардкод секретов запрещён.
