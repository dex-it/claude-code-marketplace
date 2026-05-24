# dex-github-cli

CLI-утилита для GitHub. Быстрый доступ к workflow runs, pull requests и Actions-логам через `gh`.

## Команды

| Команда | Описание |
|---------|----------|
| `/gh-runs` | Список и детали GitHub Actions workflow runs |
| `/gh-prs` | Список и детали pull requests |
| `/gh-logs` | Логи Actions run |

## Требования

- [`gh`](https://cli.github.com/) в `PATH`, авторизация через `gh auth login`

## Установка CLI

```bash
# Linux (Debian/Ubuntu) — см. github.com/cli/cli/blob/trunk/docs/install_linux.md
sudo apt install gh

# Linux (Fedora/RHEL)
sudo dnf install gh

# macOS
brew install gh

# One-shot installer (авто-детект ОС, при необходимости настраивает apt-репо GH)
./install-bundle/install-cli-tools.sh gh
```

См. [docs/CLI_UTILITIES.md](../../../docs/CLI_UTILITIES.md) — настройка auth, GitHub Enterprise self-hosted хостов, матрица CLI vs MCP.

## Установка плагина

```bash
claude plugins install dex-github-cli@dex-claude-marketplace
```
