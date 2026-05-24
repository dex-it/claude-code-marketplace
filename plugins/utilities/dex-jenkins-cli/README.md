# dex-jenkins-cli

CLI-утилита для Jenkins. Jobs, builds, console output — через официальный [`jenkins-cli`](https://www.jenkins.io/doc/book/managing/cli/) (`.jar`-клиент).

## Команды

| Команда | Описание |
|---------|----------|
| `/jk-jobs` | Список и детали jobs |
| `/jk-builds` | Список билдов конкретной job, детали билда |
| `/jk-logs` | Console output билда (опц. live `-f`) |

## Требования

- **Java runtime** (любой `default-jre` 11+ подходит)
- **jenkins-cli.jar** — версия совместимая с вашим Jenkins (Jenkins 2.54+ обязательно)
- Wrapper-скрипт `jenkins-cli` в `PATH`, который запускает jar через `java -jar`
- Env: `JENKINS_URL` (URL сервера), `JENKINS_USER_ID` (имя пользователя), `JENKINS_API_TOKEN` (token из `$JENKINS_URL/me/configure`)

## Установка CLI

Самый простой путь — `install-cli-tools.sh`: ставит Java + скачивает jar с вашего Jenkins-сервера + создаёт wrapper.

```bash
# Заранее задайте URL вашего Jenkins
export JENKINS_URL=https://jenkins.example.com

# Ставит java и jenkins-cli wrapper
./install-bundle/install-cli-tools.sh jenkins-cli
```

Скрипт скачает `jenkins-cli.jar` с `$JENKINS_URL/jnlpJars/jenkins-cli.jar` (это canonical путь, рекомендованный самим Jenkins). При апгрейде сервера jar нужно перекачать.

Ручная установка:

```bash
# Linux (Debian/Ubuntu)
sudo apt install -y default-jre

# macOS
brew install openjdk && brew link --force openjdk

# Скачайте jar с вашего Jenkins (jar сервер-зависимый)
curl -fsSL -o ~/jenkins-cli.jar "$JENKINS_URL/jnlpJars/jenkins-cli.jar"

# Wrapper в PATH
sudo tee /usr/local/bin/jenkins-cli >/dev/null <<'EOF'
#!/bin/bash
exec java -jar "${JENKINS_CLI_JAR:-$HOME/jenkins-cli.jar}" -s "$JENKINS_URL" -auth "${JENKINS_USER_ID}:${JENKINS_API_TOKEN}" "$@"
EOF
sudo chmod +x /usr/local/bin/jenkins-cli
```

См. [docs/CLI_UTILITIES.md](../../../docs/CLI_UTILITIES.md) для полного гайда: SSH-режим, версионная совместимость, troubleshooting.

## Установка плагина

```bash
claude plugins install dex-jenkins-cli@dex-claude-marketplace
```

## Безопасность

- Все команды read-only (`list-jobs`, `list-builds`, `console`). Деструктивные операции (`build`, `delete-job`, `cancel-quiet-down`) намеренно не обёрнуты — выполняются вручную или через специалистов CI/CD.
- API-токен живёт в env (`JENKINS_API_TOKEN`) и в `~/.bashrc`/`~/.zshrc` под `chmod 600`. Никогда не коммитьте.

## Breaking changes (2.0.0)

- `JENKINS_USER` → **`JENKINS_USER_ID`** (соответствует ожиданиям jenkins-cli).
- Раньше плагин использовал прямой REST API через `curl` — теперь это полноценный CLI-клиент с поддержкой SSH-режима, follow-логов (`-f`), и доступом ко всем командам Jenkins CLI.
