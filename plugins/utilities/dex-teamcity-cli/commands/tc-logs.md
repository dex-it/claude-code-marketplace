---
description: Лог билда TeamCity через teamcity run log
user-invocable: true
allowed-tools: Bash
argument-hint: "build-id [--tail N] [--watch]"
---

# /tc-logs

Показать build log TeamCity.

**Goal:** Вывести лог билда для анализа ошибок (или watch live для running-билдов).

**Output:** Build log. С `--tail N` -- последние N строк. С `--watch` -- realtime через `teamcity run watch`.

**Scenarios:**

- `build-id` -- полный лог (`teamcity run log <id>`).
- `build-id --tail N` -- последние N строк.
- `build-id --watch` -- realtime stream до завершения билда (`teamcity run watch <id>`).

**Constraints:**

- Требует `teamcity` (CLI от JetBrains) в PATH; если не найден -- показать инструкцию установки и ссылку на `docs/CLI_UTILITIES.md`.
- `--watch` блокирует -- использовать с явным таймаутом или `Ctrl-C`.
- Для артефактов и тестов используются отдельные команды CLI (`teamcity run artifacts`, `teamcity run download`).
