---
description: Статус Kubernetes — pods, deployments, health, ресурсы, events
allowed-tools: Bash, Read, Grep
argument-hint: "[namespace или deployment-name]"
---

# /k8s-status

Быстрый снимок состояния Kubernetes ресурсов.

**Goal:** Получить статус deployments, pods, health checks и resources — с выделением проблемных (CrashLoopBackOff, OOMKilled, Pending).

**Scenarios:**
- Без аргументов — overview default namespace: deployments, pods, recent events
- `<namespace>` — overview конкретного namespace
- `<deployment-name>` — детали deployment: replicas, pods, conditions, rollout status, HPA

**Output:** Таблицы: deployments (name, ready, up-to-date, available), pods (name, status, restarts, age), events (last 10 sorted by time). Warnings для unhealthy pods, высоких restart counts.

**Constraints:**
- Проверить текущий context перед выполнением
- Для problematic pods автоматически показать last terminated reason и tail logs
