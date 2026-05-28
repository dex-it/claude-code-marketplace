# dex-netcoredbg-cli

CLI-обёртка над Samsung netcoredbg для агентной runtime-диагностики .NET-сервисов. Slash-команды формируют MI2-вызовы и парсят ответы.

## Команды

| Команда | Назначение |
|---------|------------|
| `/ncdbg-attach` | Attach к managed процессу и снять managed stack trace всех потоков |
| `/ncdbg-launch` | Запустить assembly под отладкой, остановиться на entry или unhandled exception |
| `/ncdbg-exec` | Произвольная последовательность MI2-команд в attached сессии (escape-hatch) |
| `/ncdbg-dump-stacks` | Дамп managed call-stacks всех потоков в JSON для парсинга агентом |

## Требования

- [`netcoredbg`](https://github.com/Samsung/netcoredbg) в PATH
- На Linux - CAP_SYS_PTRACE для attach к чужому процессу (`ptrace_scope` см. memo ниже)
- Версия netcoredbg должна соответствовать major-версии установленного .NET runtime

## Установка CLI

```bash
# Одной командой через скрипт маркетплейса (Linux / macOS / WSL)
./install-bundle/install-cli-tools.sh netcoredbg

# Windows (PowerShell, при наличии winget)
.\install-bundle\install-cli-tools.ps1 netcoredbg
```

Скрипт скачивает релиз из `github.com/Samsung/netcoredbg/releases/latest` под целевую архитектуру и распаковывает в `/usr/local/bin/netcoredbg`.

## Установка плагина

```bash
claude plugins install dex-netcoredbg-cli@dex-claude-marketplace
```

## Ловушки permissions

- `cat /proc/sys/kernel/yama/ptrace_scope` - на Ubuntu 22.04+ default `1` (только parent). Для cross-process attach либо `sysctl -w kernel.yama.ptrace_scope=0`, либо процесс с CAP_SYS_PTRACE
- В Docker - запускать контейнер с `--cap-add=SYS_PTRACE --security-opt seccomp=unconfined`
- В Kubernetes pod - `securityContext.capabilities.add: [SYS_PTRACE]`

Подробные ловушки managed-runtime-debug - см. skill `dex-skill-managed-debug` (входит в `dex-bundle-runtime-diagnostics`).
