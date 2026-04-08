---
description: Сборка и анализ Docker образов - multi-stage, оптимизация, безопасность
allowed-tools: Bash, Read, Grep, Glob
argument-hint: [--analyze | --build | --scan]
---

# /docker-build

**Goal:** Собрать Docker образ, проанализировать Dockerfile на best practices или просканировать на уязвимости.

**Scenarios:**

- `--analyze` -- найти все Dockerfiles в проекте, проверить multi-stage build, non-root user, layer ordering, .dockerignore, конкретные теги (не :latest), HEALTHCHECK
- `--build` -- собрать образ с BuildKit, тегировать по git commit hash
- `--scan` -- сканировать образ через Docker Scout, Trivy или Grype

**Output:**

- Checklist с результатами анализа (multi-stage, non-root, .dockerignore, tags, HEALTHCHECK)
- Результат сборки: имя образа, размер, количество слоёв, время сборки
- Таблица уязвимостей по severity (Critical/High/Medium/Low)
- Рекомендации по устранению найденных проблем

**Constraints:**

- Использовать DOCKER_BUILDKIT=1 при сборке
- Тегировать образ по git short hash, не :latest
- При сканировании использовать первый доступный инструмент (scout > trivy > grype)
- Не встраивать в вывод полные Dockerfiles -- только findings и рекомендации
