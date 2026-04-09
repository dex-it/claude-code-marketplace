---
description: Генерация GitHub Actions workflow для проекта
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
argument-hint: "[project-type] [--deploy target]"
---

# /workflow

Создать GitHub Actions workflow YAML для текущего проекта.

**Goal:** Сгенерировать `.github/workflows/ci.yml` (или несколько файлов при сложном pipeline), покрывающий build → test → deploy.

**Output:** Готовые workflow файлы в `.github/workflows/`.

**Scenarios:**

- `node` / `python` / `dotnet` / `go` — стек проекта
- `--deploy docker` / `--deploy k8s` / `--deploy pages` — deployment target
- Без аргументов — автодетект стека по файлам проекта (package.json, requirements.txt, *.csproj, go.mod)

**Constraints:**

- Не перезаписывать существующие workflow файлы без подтверждения
- `permissions:` задать явно
- Actions pinned по SHA для third-party
