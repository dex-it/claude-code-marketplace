---
description: Генерация Jenkinsfile для проекта
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
argument-hint: "[project-type] [--agents label]"
---

# /jenkinsfile

Создать Jenkinsfile для текущего проекта.

**Goal:** Сгенерировать `Jenkinsfile` в корне проекта, покрывающий build → test → deploy. Declarative Pipeline по умолчанию.

**Output:** Файл `Jenkinsfile` в корне проекта.

**Scenarios:**

- `node` / `python` / `dotnet` / `java` — стек проекта
- `--agents docker` / `--agents label-name` — agent strategy
- Без аргументов — автодетект стека по файлам проекта

**Constraints:**

- Не перезаписывать существующий Jenkinsfile без подтверждения
- Declarative Pipeline, не Scripted
- Credentials через `withCredentials`, не hardcoded
