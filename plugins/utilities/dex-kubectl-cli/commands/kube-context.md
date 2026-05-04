---
description: Текущий kube-контекст, namespace, KUBECONFIG; список и переключение
user-invocable: true
allowed-tools: Bash
argument-hint: "[context-name] [--ns namespace] [--list] [--show-kubeconfig]"
---

# /kube-context

Управлять активным контекстом Kubernetes и namespace.

**Goal:** Показать текущий контекст / namespace / `KUBECONFIG`, перечислить доступные контексты, при необходимости переключить.

**Output:** Текущий контекст (имя, cluster, user, namespace) и путь(и) `KUBECONFIG`. С `--list` -- таблица контекстов (current `*`, name, cluster, user, namespace).

**Scenarios:**

- Без аргументов -- текущий контекст и namespace, путь к `KUBECONFIG`.
- `--list` -- список всех контекстов из `KUBECONFIG`.
- `--show-kubeconfig` -- развёрнутый путь(и) `KUBECONFIG` (учитывая merged через `:`) и активный.
- `context-name` -- переключить активный контекст (`kubectl config use-context`).
- `--ns namespace` -- сменить namespace в текущем контексте (`kubectl config set-context --current --namespace`).

**Constraints:**

- Требует `kubectl` в PATH; если не найден -- показать инструкцию установки и ссылку на `docs/CLI_UTILITIES.md`.
- **Переключение контекста меняет `~/.kube/config` для всех терминалов пользователя**, не только для Claude Code. Перед `use-context` показать «было -> станет» и не «угадывать» имя -- если введено частично, перечислить совпадения и не переключать.
- На production-кластерах безопаснее использовать read-only kubeconfig (RBAC `get`/`list`/`watch`) -- см. `docs/CLI_UTILITIES.md` Security.
- Никаких deletions/applies -- эта команда трогает только конфиг клиента.
