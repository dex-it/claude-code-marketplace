---
description: Статус Kubernetes deployments и rollout через kubectl
user-invocable: true
allowed-tools: Bash
argument-hint: "[-n namespace] [deployment-name] [--history]"
---

# /kube-deploy

Показать статус deployments в Kubernetes через kubectl.

**Goal:** Список deployments с репликами, rollout status, HPA.

**Output:** Таблица: name, ready, up-to-date, available, image. Для конкретного -- rollout history, HPA status, conditions.

**Scenarios:**

- Без аргументов -- все deployments в default namespace
- `-n namespace` -- deployments в конкретном namespace
- `deployment-name` -- детали + rollout status + HPA
- `--history` -- rollout history с revision details

**Constraints:**

- Требует `kubectl` с настроенным доступом к кластеру
