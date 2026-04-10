---
description: Логи Kubernetes pod/container через kubectl
user-invocable: true
allowed-tools: Bash
argument-hint: pod-name [-n namespace] [--tail N] [--previous] [-c container]
---

# /kube-logs

Показать логи pod или контейнера в Kubernetes через kubectl.

**Goal:** Вывести логи контейнера для анализа ошибок или мониторинга.

**Output:** Лог контейнера. С `--previous` -- логи предыдущего инстанса (после рестарта).

**Scenarios:**

- `pod-name` -- текущие логи пода
- `--tail N` -- последние N строк
- `--previous` -- логи предыдущего контейнера (полезно после OOMKill/CrashLoop)
- `-c container` -- конкретный контейнер в multi-container pod
- `-n namespace` -- namespace пода

**Constraints:**

- Требует `kubectl` с настроенным доступом к кластеру
- Для `--previous` pod должен иметь историю рестартов
