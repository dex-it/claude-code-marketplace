---
title: Что нужно
description: Версия Claude Code, git, jq, платформы и что требуется отдельным плагинам.
---

Для работы с каталогом хватает Claude Code и `git`. Остальное нужно для скриптов установки и для отдельных плагинов.

## Обязательное

| Что | Зачем |
|---|---|
| **Claude Code** | Каталог - набор плагинов для него. Нужна актуальная версия; команды на этом сайте сверены с Claude Code 2.1.308 |
| **git** | Клон репозитория: из него запускается скрипт установки бандла |
| **jq** | Нужен скриптам установки на Linux и macOS (`install-bundle.sh`, `uninstall-bundle.sh`, `sync-plugins.sh`) |

Установить `jq`: `brew install jq` (macOS), `sudo apt install jq` (Ubuntu и Debian), `sudo pacman -S jq` (Arch).

## Платформы

- **Linux** - основной путь. Скриптам нужен `jq`; `install-cli-tools.sh` сам определяет пакетный менеджер: apt, dnf, pacman или apk.
- **macOS** - Intel и Apple Silicon. Скрипты работают на стоковом `/bin/bash` 3.2, отдельный bash не нужен. Часть низкоуровневых утилит ограничена платформой: `netcoredbg` и `valgrind` не собираются под Apple Silicon, а `strace`, `bpftrace`, `bcc` и `perf` есть только на Linux.
- **Windows** - через PowerShell-скрипты (`*.ps1`, нужен PowerShell 5.1 или новее) или через WSL.

## Нужно не всем

Эти вещи требуются только отдельным плагинам. Бандл `code-review` из быстрого старта без них работает.

| Что | Для чего |
|---|---|
| Бинарники `gh`, `kubectl`, `psql` и другие | CLI-плагины - тонкие команды над ними. Сами программы должны быть на машине: [Утилиты](/catalog/utilities/) |
| `python3` | Плагин `dex-auto`: на нём журнал задачи и хуки |
| `gh`, `glab` или MCP-сервер хостинга | Публикация находок в MR или PR и открытие PR |
| Node.js | Плагин `dex-playwright-cli` и MCP-серверы, запускаемые через npx |
| Claude Code 2.1.287 или новее | Моды: [Моды](/catalog/mods/) |
| API-ключи | Для MCP-интеграций: список в [CREDENTIALS.md на GitHub](https://github.com/dex-it/claude-code-marketplace/blob/main/CREDENTIALS.md) |

## Откуда берутся плагины

Плагины загружает сам Claude Code из каталога `dex-it/claude-code-marketplace` на GitHub. Клон репозитория нужен скрипту установки, чтобы прочитать состав бандла.
