---
description: Статус Kubernetes pods через kubectl
allowed-tools: Bash
argument-hint: "[-n namespace] [--label app=name] [--wide]"
---

# /kube-pods

Показать статус pods в Kubernetes кластере через kubectl.

**Goal:** Список pods с их статусом, рестартами, ресурсами.

**Output:** Таблица: name, status, restarts, age, node. С `--wide` -- IP, resource usage (cpu/memory).

**Scenarios:**

- Без аргументов -- pods в default namespace
- `-n namespace` -- pods в конкретном namespace
- `--label app=name` -- фильтр по label selector
- `--wide` -- расширенный вывод с IP, node, resource usage

**Constraints:**

- Требует `kubectl` с настроенным доступом к кластеру
- Если kubectl не найден или нет доступа -- показать инструкцию
