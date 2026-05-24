# Bundle: dex-bundle-cli-tools

Бандл CLI-инструментов для диагностики: VCS/CI, Kubernetes, базы данных, мессенджинг, облако, browser testing. Одиннадцать тонких обёрток над проверенными CLI (`gh`, `glab`, `kubectl`, `jenkins`, `teamcity`, `psql`, `redis-cli`, `kaf`, `rabbitmqadmin`, `aws`, `npx playwright`) -- установить один раз, получить единообразный набор slash-команд по всем стекам.

## Установка

```bash
# Linux / macOS / WSL
./install-bundle/install-bundle.sh cli-tools

# Windows (PowerShell)
.\install-bundle\install-bundle.ps1 cli-tools

# Предпросмотр
./install-bundle/install-bundle.sh cli-tools --dry-run
```

## Удаление

```bash
# Linux / macOS / WSL
./install-bundle/uninstall-bundle.sh cli-tools

# Windows (PowerShell)
.\install-bundle\uninstall-bundle.ps1 cli-tools
```

## Состав (11)

### VCS & CI/CD (5)
- `dex-github-cli` -- GitHub Actions runs, PRs, logs (`gh`)
- `dex-gitlab-cli` -- GitLab pipelines, MRs, job logs (`glab`)
- `dex-kubectl-cli` -- Kubernetes pods/logs/deployments/events/contexts (`kubectl`)
- `dex-jenkins-cli` -- Jenkins jobs, builds, console output (REST API)
- `dex-teamcity-cli` -- TeamCity builds, agents, build logs (REST API)

### Data & Messaging (4)
- `dex-psql-cli` -- PostgreSQL queries/schema/explain/locks (`psql`)
- `dex-redis-cli` -- Redis info/keys/memory/monitor (`redis-cli`)
- `dex-kaf-cli` -- Kafka topics/groups/consume/produce ([`kaf`](https://github.com/birdayz/kaf))
- `dex-rabbitmqadmin-cli` -- RabbitMQ overview/queues/bindings/publish ([`rabbitmqadmin-ng`](https://github.com/rabbitmq/rabbitmqadmin-ng))

### Cloud (1)
- `dex-aws-s3-cli` -- AWS S3 ls/info/head/presign (`aws s3` / `s3api`)

### Browser testing (1)
- `dex-playwright-cli` -- Playwright test runner / show-report / codegen / trace viewer / install (`npx playwright`)

## Установка CLI-бинарей

Этот бандл ставит **плагины** для Claude Code -- самим CLI (`gh`, `glab`, `kubectl`, `psql`, `redis-cli`, `kaf`, `rabbitmqadmin`, `aws`) ещё нужно быть установленными на машине. Используйте парный установщик:

```bash
# Что уже стоит, чего не хватает
./install-bundle/install-cli-tools.sh --check

# Поставить всё недостающее (Linux/macOS)
./install-bundle/install-cli-tools.sh --all

# Точечно
./install-bundle/install-cli-tools.sh psql redis-cli kaf rabbitmqadmin aws
```

Playwright не входит в `install-cli-tools.sh` -- это npm-пакет, не системный бинарь. Зависимость -- Node.js (для `npx`); браузерные движки ставятся через `/pw-install` после `npm i -D @playwright/test` в самом проекте.

См. [docs/CLI_UTILITIES.md](../../../docs/CLI_UTILITIES.md) -- установочная матрица, конфигурация (KUBECONFIG, PGPASSFILE, `~/.kaf/config`, `~/.rabbitmqadmin.conf`, `~/.aws/`, ACL/TLS), матрица CLI vs MCP, troubleshooting.

## Замечание

Бандл пересекается с `dex-bundle-infrastructure` (туда тоже входят эти CLI-плагины + специалисты + skills). Если уже установлен `infrastructure`, установка `cli-tools` отрапортует «already installed» по общим компонентам -- без дублирования.

Каждый компонент работает независимо -- бандл это convenience-wrapper.
