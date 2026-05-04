# dex-kubectl-cli

CLI-утилита для Kubernetes. Pods, logs, deployments, events, контексты — через `kubectl`.

## Команды

| Команда | Описание |
|---------|----------|
| `/kube-pods` | Статус pod'ов |
| `/kube-logs` | Логи pod / контейнера |
| `/kube-deploy` | Статус deployments и rollout |
| `/kube-events` | События кластера |
| `/kube-context` | Текущий контекст / namespace / KUBECONFIG; список и переключение |

## Требования

- [`kubectl`](https://kubernetes.io/docs/tasks/tools/) в `PATH`, настроенный доступ к кластеру
- Валидный `KUBECONFIG` (по умолчанию `~/.kube/config`) хотя бы с одним контекстом

## Установка CLI

```bash
# Linux (Debian/Ubuntu) — официальный k8s apt-репо
sudo apt install kubectl    # настройка репо: kubernetes.io

# Linux (Fedora/RHEL)
sudo dnf install kubectl

# macOS
brew install kubectl

# One-shot installer (авто-детект ОС)
./install-bundle/install-cli-tools.sh kubectl
```

## Конфигурация

`kubectl` берёт информацию о кластере из kubeconfig-файла. По умолчанию — `~/.kube/config`.

### KUBECONFIG: один файл vs объединение

Можно указать несколько kubeconfig-файлов через `:` (Linux/macOS) — итоговое представление будет **объединением** всех:

```bash
export KUBECONFIG=~/.kube/config:~/.kube/staging:~/.kube/prod
kubectl config get-contexts        # контексты из всех трёх
```

### Контексты vs namespaces

**Контекст** = (cluster, user, namespace). В одном kubeconfig обычно много контекстов. Активный контекст определяет, в какой кластер уйдёт каждая команда.

```bash
kubectl config current-context              # что активно прямо сейчас
kubectl config get-contexts                 # все контексты (или /kube-context --list)
kubectl config use-context <name>           # переключить активный контекст
kubectl config set-context --current --namespace=<ns>   # сменить namespace в текущем контексте
```

`/kube-context` оборачивает эти примитивы и печатает «было → станет», чтобы случайные переключения на shared-машине были видны.

### Безопасность на production-кластерах

- `~/.kube/config` **общий для всех терминалов пользователя** — переключение контекста влияет на все shell'ы, не только на Claude Code.
- Для прода предпочтительно использовать **read-only kubeconfig**: service account с RBAC, ограниченным до `get` / `list` / `watch` без `create` / `delete` / `patch`. Пример RBAC-манифеста — в `docs/CLI_UTILITIES.md`.
- Никогда не делитесь kubeconfig-файлами через чат / коммиты — там bearer-токены или client-cert.

См. [docs/CLI_UTILITIES.md](../../../docs/CLI_UTILITIES.md) — multi-cluster setup, OIDC/exec auth, troubleshooting, матрица CLI vs MCP.

## Установка плагина

```bash
claude plugins install dex-kubectl-cli@dex-claude-marketplace
```
