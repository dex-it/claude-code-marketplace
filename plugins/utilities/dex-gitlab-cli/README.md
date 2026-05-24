# dex-gitlab-cli

CLI-утилита для GitLab. Быстрый доступ к pipelines, merge requests и логам CI-job через `glab`.

## Команды

| Команда | Описание |
|---------|----------|
| `/gl-pipelines` | Список и детали GitLab CI pipelines |
| `/gl-mrs` | Список и детали merge requests |
| `/gl-logs` | Логи CI-job |

## Требования

- [`glab`](https://gitlab.com/gitlab-org/cli) в `PATH`, авторизация через `glab auth login`

## Установка CLI

```bash
# Linux (Debian/Ubuntu) — официальный установочный скрипт
curl -fsSL https://gitlab.com/gitlab-org/cli/-/raw/main/scripts/install.sh | sudo bash

# Linux (Fedora/RHEL)
sudo dnf install glab

# macOS
brew install glab

# One-shot installer (авто-детект ОС)
./install-bundle/install-cli-tools.sh glab
```

Для self-hosted GitLab: `glab config set --global hostname gitlab.acme.io`. См. [docs/CLI_UTILITIES.md](../../../docs/CLI_UTILITIES.md) — auth, multi-host, матрица CLI vs MCP.

## Установка плагина

```bash
claude plugins install dex-gitlab-cli@dex-claude-marketplace
```
