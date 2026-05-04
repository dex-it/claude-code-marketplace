# Гайд по CLI-утилитам

Хаб CLI-плагинов маркетплейса Claude Code: каталог, матрица установки, конфигурация, CLI vs MCP, troubleshooting, безопасность.

> **TL;DR.** CLI-плагины — это тонкие slash-команды-обёртки над проверенными CLI (`gh`, `glab`, `kubectl`, `psql`, `redis-cli`, `kaf`, `rabbitmqadmin`, `aws`). Используйте их для read-only диагностики и точечных операций. MCP-серверы остаются предпочтительными, когда агенту нужен автономный многошаговый workflow по той же системе.

---

## Зачем CLI-плагины

- **Легковесные.** Без долгоживущего сервера, без отдельной поверхности credentials, без протокольного слоя. Плагин — это slash-команда, вызывающая знакомый вам CLI.
- **Прозрачные.** Claude выполняет обычный `kubectl get pods` (или `psql -c '...'`). Команду можно скопировать, проверить в shell-history, выполнить локально.
- **Композируемые.** Slash-команды идемпотентны и ортогональны — `/kube-pods`, `/kube-logs`, `/kube-events` покрывают повседневный диагностический цикл без одной «делай-всё» утилиты.
- **Без vendor lock-in.** Плагин — это 30 строк markdown. Если CLI изменится или вы переключитесь — заменяете один файл.

---

## Каталог CLI-утилит

| Плагин | Бинарь | Домен | Команды |
|---|---|---|---|
| `dex-github-cli` | `gh` | VCS / CI | `/gh-runs` `/gh-prs` `/gh-logs` |
| `dex-gitlab-cli` | `glab` | VCS / CI | `/gl-pipelines` `/gl-mrs` `/gl-logs` |
| `dex-jenkins-cli` | REST | CI | `/jk-jobs` `/jk-builds` `/jk-logs` |
| `dex-teamcity-cli` | REST | CI | `/tc-builds` `/tc-agents` `/tc-logs` |
| `dex-kubectl-cli` | `kubectl` | Kubernetes | `/kube-pods` `/kube-logs` `/kube-deploy` `/kube-events` `/kube-context` |
| `dex-psql-cli` | `psql` | PostgreSQL | `/psql-query` `/psql-schema` `/psql-explain` `/psql-locks` |
| `dex-redis-cli` | `redis-cli` | Redis | `/redis-info` `/redis-keys` `/redis-memory` `/redis-monitor` |
| `dex-kaf-cli` | `kaf` | Kafka | `/kaf-topics` `/kaf-groups` `/kaf-consume` `/kaf-produce` |
| `dex-rabbitmqadmin-cli` | `rabbitmqadmin` | RabbitMQ | `/rmq-overview` `/rmq-queues` `/rmq-bindings` `/rmq-publish` |
| `dex-aws-s3-cli` | `aws s3` / `s3api` | AWS S3 | `/s3-ls` `/s3-info` `/s3-head` `/s3-presign` |

Установить все десять одной командой — через бандл [`dex-bundle-cli-tools`](../plugins/bundles/dex-bundle-cli-tools/README.md).

---

## Установка CLI-бинарей

Плагины вызывают `gh`, `glab`, `kubectl`, `psql`, `redis-cli`, `kaf`, `rabbitmqadmin`, `aws` — эти бинари должны быть на машине. Используйте one-shot установщик или ручные рецепты из матрицы.

### One-shot установщик (рекомендовано, Linux + macOS)

```bash
# Что уже стоит, чего не хватает
./install-bundle/install-cli-tools.sh --check

# Поставить всё недостающее
./install-bundle/install-cli-tools.sh --all

# Точечно
./install-bundle/install-cli-tools.sh psql redis-cli kaf rabbitmqadmin aws

# Предпросмотр без установки
./install-bundle/install-cli-tools.sh --all --dry-run
```

Скрипт автоматически детектит ОС (`uname -s`) и пакетный менеджер (`apt` / `dnf` / `pacman` / `apk` на Linux; `brew` на macOS) и подбирает рецепт. Идемпотентен — повторный запуск безопасен.

### Матрица ручной установки

| Бинарь | Linux (Debian/Ubuntu) | Linux (Fedora/RHEL) | macOS | Источник |
|---|---|---|---|---|
| `gh` | `apt install gh` (после [настройки apt-репо GH](https://github.com/cli/cli/blob/trunk/docs/install_linux.md)) | `dnf install gh` | `brew install gh` | [cli.github.com](https://cli.github.com/) |
| `glab` | `apt install glab` (или [.deb-релиз](https://gitlab.com/gitlab-org/cli/-/releases)) | `dnf install glab` | `brew install glab` | [gitlab.com/.../cli](https://gitlab.com/gitlab-org/cli) |
| `kubectl` | apt-репо `pkgs.k8s.io` ([гайд](https://kubernetes.io/docs/tasks/tools/install-kubectl-linux/)) | dnf-репо `pkgs.k8s.io` | `brew install kubectl` | [kubernetes.io/.../tools](https://kubernetes.io/docs/tasks/tools/) |
| `psql` | `apt install postgresql-client` | `dnf install postgresql` | `brew install libpq && brew link --force libpq` | [postgresql.org/download](https://www.postgresql.org/download/) |
| `redis-cli` | `apt install redis-tools` | `dnf install redis` | `brew install redis` | [redis.io/.../install](https://redis.io/docs/install/install-redis/) |
| `kaf` | curl из [github releases](https://github.com/birdayz/kaf/releases) | curl из github releases | `brew tap birdayz/tap && brew install kaf` | [github.com/birdayz/kaf](https://github.com/birdayz/kaf) |
| `rabbitmqadmin` | curl из [github releases](https://github.com/rabbitmq/rabbitmqadmin-ng/releases) | curl из github releases | `brew tap rabbitmq/tap && brew install rabbitmqadmin` | [github.com/rabbitmq/rabbitmqadmin-ng](https://github.com/rabbitmq/rabbitmqadmin-ng) |
| `aws` (CLI v2) | bundled installer (`curl awscli-exe-linux-*.zip` + `unzip` + `./aws/install`) | bundled installer | `brew install awscli` | [docs.aws.amazon.com/cli/.../install](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) |

> Windows: PowerShell-зеркало доступно — `install-bundle/install-cli-tools.ps1` (использует `winget` / `scoop` / `choco`). WSL — также полностью поддерживаемый путь.

---

## Конфигурация

### kubectl

`kubectl` берёт информацию о кластере из **kubeconfig**-файла. По умолчанию — `~/.kube/config`.

```bash
kubectl config current-context              # что активно сейчас
kubectl config get-contexts                 # список всех контекстов
kubectl config use-context <name>           # переключить контекст
kubectl config set-context --current --namespace=<ns>   # сменить namespace в текущем контексте
```

**Несколько kubeconfig-файлов** объединяются при склейке через `:`:

```bash
export KUBECONFIG=~/.kube/config:~/.kube/staging:~/.kube/prod
kubectl config get-contexts        # контексты из всех трёх
```

`/kube-context` оборачивает эти примитивы, печатает «было → станет» при переключении и не подставляет частичные имена контекстов — чтобы случайные переключения на shared-машине были видны.

**RBAC для production.** Для прод-кластеров используйте отдельный service account с read-only RBAC:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: claude-readonly
rules:
- apiGroups: ["", "apps", "batch"]
  resources: ["*"]
  verbs: ["get", "list", "watch"]
```

Привяжите к ServiceAccount, сгенерируйте токен, соберите kubeconfig, указывающий на этот SA — и `kubectl` физически не сможет ничего изменить.

### psql (PostgreSQL)

Параметры подключения — через env или connection URI:

```bash
# Env
export PGHOST=db.example.com
export PGPORT=5432
export PGUSER=alice
export PGDATABASE=app
# пароль через PGPASSFILE (рекомендовано) или PGPASSWORD

# Или URI
export DATABASE_URL='postgresql://alice@db.example.com:5432/app?sslmode=require'
psql "$DATABASE_URL" -c 'SELECT 1'
```

**Формат `~/.pgpass`** (`chmod 600`):

```
hostname:port:database:username:password
```

**SSL.** Добавьте `?sslmode=require` (или `verify-full` для прода с pinned-сертификатом). Кастомный CA — через `PGSSLROOTCERT`.

**Read-only роль.** Для Claude-сессии создайте отдельную роль с `pg_read_all_data` (PG 14+) или с `SELECT` на нужные схемы. Slash-команды плагина уже отвергают DDL/DML на уровне команды — read-only роль это durable-граница безопасности.

### redis-cli

```bash
# URI (рекомендовано — пароль не светится в ps)
export REDIS_URL='rediss://default:s3cret@redis.example.com:6379/0'
redis-cli -u "$REDIS_URL" PING

# Или env
export REDIS_HOST=redis.example.com
export REDIS_PORT=6380
export REDISCLI_AUTH=s3cret    # предпочтительнее флага -a (он виден в ps)
```

**ACL-пользователи (Redis 6+).** Создать read-only пользователя:

```
ACL SETUSER claude on >mypassword ~* +@read +@connection -@dangerous
```

**TLS.** Используйте схему `rediss://`; для self-signed добавьте `--tls --cacert /path/to/ca.crt`.

### kaf (Kafka)

`kaf` хранит описания кластеров в `~/.kaf/config`. Один раз добавили кластер — дальше команды работают с активным (или с `--cluster <name>`).

```bash
# Локальный брокер
kaf config add-cluster local --brokers localhost:9092
kaf config select-cluster local

# SASL/PLAIN
kaf config add-cluster prod \
  --brokers broker-1:9092,broker-2:9092 \
  --sasl-mechanism PLAIN \
  --username svc-claude \
  --password '...'

# TLS
kaf config add-cluster prod-tls \
  --brokers broker-1:9093 \
  --tls-ca /etc/ssl/ca.crt
```

Декодеры **schema registry / Avro / Protobuf** настраиваются per-cluster в том же конфиге — см. `kaf config -h`.

### rabbitmqadmin (rabbitmqadmin-ng)

`rabbitmqadmin-ng` использует HTTP API брокера (плагин `rabbitmq_management`, по умолчанию порт 15672). Конфиг — `~/.rabbitmqadmin.conf`:

```ini
[default]
hostname = rabbit.example.com
port = 15672
username = svc-claude
password = ...
vhost = /

[prod]
hostname = rabbit-prod.example.com
port = 15671
tls = true
username = ...
password = ...
```

Использование:

```bash
rabbitmqadmin show overview                  # активный профиль (default)
rabbitmqadmin --node prod show overview      # переключиться на профиль prod
rabbitmqadmin --host rabbit.acme.io --port 15672 --username u --password p list queues
```

**Безопасность.** Для прода — отдельный read-only пользователь с тегом `monitoring`:

```bash
rabbitmqctl add_user claude '...'
rabbitmqctl set_user_tags claude monitoring
rabbitmqctl set_permissions -p / claude '' '' '.*'   # configure='', write='', read='.*'
```

С такими правами `/rmq-overview`, `/rmq-queues`, `/rmq-bindings` работают, а `declare/delete/purge` физически невозможны.

### aws (AWS CLI v2)

Параметры доступа — `~/.aws/credentials` / `~/.aws/config` или env (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN` / `AWS_PROFILE` / `AWS_REGION`).

```bash
aws configure                  # дефолтный профиль (интерактивно)
aws configure --profile prod   # дополнительный профиль
aws sts get-caller-identity    # проверка: кто вы сейчас
```

**Multi-profile + assume-role** в `~/.aws/config`:

```ini
[profile dev]
region = eu-central-1
output = json

[profile prod]
source_profile = dev
role_arn = arn:aws:iam::123456789012:role/ReadOnlyAdmin
mfa_serial = arn:aws:iam::123456789012:mfa/alice
```

**SSO** (рекомендовано вместо долгоживущих ключей):

```ini
[profile work]
sso_start_url = https://acme.awsapps.com/start
sso_region = eu-central-1
sso_account_id = 123456789012
sso_role_name = ReadOnly
region = eu-central-1
```

```bash
aws sso login --profile work
```

**Read-only IAM-политика** для CLI-плагина — минимум `s3:Get*`, `s3:List*` (и `kms:Decrypt` если бакеты под KMS). Это durable-граница безопасности; slash-команды плагина уже не предлагают destructive-операций.

### gh / glab

```bash
gh auth login          # интерактивно — выбор хоста (github.com / GHES) и метода (HTTPS+токен / SSH)
glab auth login        # то же для GitLab.com / self-hosted

gh auth status         # проверка
glab auth status
```

Для self-hosted у `gh` несколько хост-конфигов (`gh auth login --hostname ghe.acme.io`); у `glab` — `glab config set --global hostname gitlab.acme.io`.

Токены живут в `~/.config/gh/hosts.yml` и `~/.config/glab-cli/config.yml` — никогда не коммитьте их.

---

## CLI vs MCP: матрица решений

CLI-утилиты и MCP-серверы дополняют друг друга. Выбирайте под сценарий:

| Сценарий | Что выбрать | Почему |
|---|---|---|
| Read-only диагностика («покажи поды», «объясни запрос», «что в этом топике») | **CLI** | Одна команда, никакой инфры, низкий blast radius |
| Быстрая проверка во время debugging-сессии | **CLI** | Быстрее, без setup, вывод сразу попадает в разговор |
| Длинный автономный workflow («агент, рефактори и проверь на живой БД») | **MCP** | Структурированная схема инструментов + многошаговые вызовы без явных запросов |
| Нужны write/mutate операции через Claude | **MCP** (с явной auth-границей) | CLI-плагины здесь read-only by design |
| Локальная разработка, MCP-сервер не настроен | **CLI** | Нулевая дополнительная зависимость |
| Командная установка с несколькими агентами на одну БД/кластер | **MCP** | Централизованная авторизация, аудит, rate-limit на стороне MCP |
| Не хотите ещё одну credentials-поверхность | **CLI** | Использует существующий CLI-auth — без отдельных credentials для MCP |

Для систем из нашего каталога — соответствия с MCP (см. `mcp/README.md`):

- **PostgreSQL / Redis** — generic-MCP `genai-toolbox` покрывает обе. CLI-плагины (`dex-psql-cli`, `dex-redis-cli`) замещают его для read-only сценариев.
- **Kafka** — `kafka-mcp-server` (Go-бинарь). `dex-kaf-cli` замещает его для one-shot read-задач; MCP оставьте, если агент должен автономно оркестрировать многими топиками.
- **RabbitMQ** — есть `rabbitmq` MCP (через `rabbitmq_broker_initialize_connection`). `dex-rabbitmqadmin-cli` замещает его для read-only через HTTP API; MCP оставьте для AMQP-операций.
- **AWS S3** — отдельного S3-MCP в каталоге нет. `dex-aws-s3-cli` — основной путь для read-only.
- **Kubernetes** — first-party MCP в каталоге нет; `dex-kubectl-cli` — основной путь.
- **GitHub / GitLab** — `gh` / `glab` зрелые CLI; MCP имеет смысл только при автономном управлении многими репами.

---

## Бандл `dex-bundle-cli-tools`

```bash
./install-bundle/install-bundle.sh cli-tools
# Или PowerShell на Windows:
.\install-bundle\install-bundle.ps1 cli-tools
```

Ставит все 10 CLI-плагинов (gh, glab, kubectl, jenkins, teamcity, psql, redis-cli, kaf, rabbitmqadmin, aws-s3). Пересекается с `dex-bundle-infrastructure` — если он уже установлен, CLI-плагины придут с ним; запуск `cli-tools` для уже установленных компонентов просто отрапортует «already installed».

Для установки самих CLI-бинарей на чистой машине — после бандла:

```bash
./install-bundle/install-cli-tools.sh --all
```

---

## Troubleshooting

### «command not found»
Плагин нашёл slash-команду, но CLI-бинарь отсутствует. Запустите `./install-bundle/install-cli-tools.sh --check` — увидите, чего не хватает.

### `gh auth status` говорит «no logged-in account»
Запустите `gh auth login`. Для GitHub Enterprise — `--hostname ghe.acme.io`.

### `kubectl` подключается, но возвращает «no resources» / не тот кластер
Проверьте `/kube-context` — возможно вы на устаревшем контексте. `--list` показывает все, переключайтесь по полному имени (плагин не принимает частичные совпадения, чтобы избежать сюрпризов).

### `psql` зависает на подключении
Типичные причины: PG отбрасывает ваш IP в `pg_hba.conf`; SSL обязателен, но `sslmode` не задан; пароль неверен, но PG требует client cert. Запустите вручную: `psql -d "$DATABASE_URL" -c 'SELECT 1' -v ON_ERROR_STOP=1` — увидите ошибку.

### `redis-cli --latency` отвечает «Could not connect»
По умолчанию `localhost:6379` — установите `REDIS_URL` или передайте `-h host -p port`. Для TLS — `rediss://`, не `redis://`.

### `kaf topics` отвечает «no clusters»
Не выбран кластер. `kaf config get-clusters`, затем `kaf config select-cluster <name>`. Если список пуст — `kaf config add-cluster ...`.

### `rabbitmqadmin` отвечает 404 / Connection refused
Включён ли management plugin? `rabbitmq-plugins enable rabbitmq_management`. Порт по умолчанию 15672, не путайте с AMQP-портом 5672.

### `aws s3 ls` отвечает «Unable to locate credentials»
Нет ни env, ни `~/.aws/credentials`. `aws configure` или `aws sso login --profile <name>`. Проверка: `aws sts get-caller-identity`.

### `MONITOR` из `/redis-monitor` блокирует терминал
Плагин принудительно ставит timeout (≤10s). Если запускали `redis-cli MONITOR` напрямую и он висит — `Ctrl-C` и не оставляйте на проде, он бьёт по throughput.

---

## Безопасность

- **Все read-команды read-only by design.** `/psql-query` и `/psql-explain` отвергают `INSERT`/`UPDATE`/`DELETE`/DDL/DCL на уровне slash-команды. `/redis-keys` использует только `SCAN`. `/kube-context` мутирует только локальный kubeconfig. RabbitMQ-команды выполняют только `show`/`list`. S3-команды — только `Get*`/`List*` API.
- **Никаких секретов в чате.** Токены, пароли, kubeconfig-блобы — через env (`PGPASSWORD`, `REDISCLI_AUTH`, `GH_TOKEN`, `AWS_*`) или конфиги (`~/.pgpass`, `~/.kube/config`, `~/.kaf/config`, `~/.rabbitmqadmin.conf`, `~/.aws/credentials`) с правильными правами (`chmod 600`).
- **Least-privilege роли для прода.** Read-only DB-роли, read-only kubeconfig'и, ACL-пользователи Redis, monitoring-tag в RabbitMQ, ReadOnly-IAM в AWS. Slash-команды — это convenience; durable-граница безопасности живёт в той системе, к которой подключаетесь.
- **`/kaf-produce` и `/rmq-publish` пишут в реальные exchanges/topics.** Используйте staging или dedicated test-ресурсы; никогда — против shared-prod-топиков с downstream-эффектами (events, биллинг).
- **`/redis-monitor` и `--bigkeys`-сканы нагружают прод.** Только в окнах низкой нагрузки.
- **`/s3-presign`** создаёт URL до 7 дней — обращайтесь как с секретом: не публиковать.

---

## Добавление новой CLI-утилиты

Хотите обернуть ещё один CLI? См. `docs/COMMAND_FRAMEWORK.md` для структуры slash-команд и существующие утилиты (`plugins/utilities/dex-*-cli/`) как образцы. Кратко:

1. Создать `plugins/utilities/dex-<tool>-cli/` с `.claude-plugin/plugin.json`, `commands/<cmd>.md` (3–5 команд), `README.md` со ссылкой на этот хаб.
2. Каждая команда: 20–50 строк, frontmatter (`description` / `user-invocable: true` / `allowed-tools: Bash` / `argument-hint`), тело — `Goal` / `Output` / `Scenarios` / `Constraints`.
3. Зарегистрировать плагин в `.claude-plugin/marketplace.json`.
4. Добавить рецепт в `install-bundle/install-cli-tools.sh` (и матрицу выше).
5. Прогнать `npm run validate`.
