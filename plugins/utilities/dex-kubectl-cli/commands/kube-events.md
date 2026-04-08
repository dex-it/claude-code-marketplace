---
description: События Kubernetes кластера через kubectl
allowed-tools: Bash
argument-hint: "[-n namespace] [--type Warning]"
---

# /kube-events

Показать events в Kubernetes кластере через kubectl.

**Goal:** Список событий кластера, отсортированных по времени, для быстрой диагностики.

**Output:** Таблица: time, type, reason, object, message. Warnings выделены.

**Scenarios:**

- Без аргументов -- все events в default namespace, последние по времени
- `-n namespace` -- events в конкретном namespace
- `--type Warning` -- только warnings (ошибки, проблемы)

**Constraints:**

- Требует `kubectl` с настроенным доступом к кластеру
