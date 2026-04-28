---
description: Применить предложения /mr-analyze к файлам маркетплейса с self-review и валидацией. Bump versions по semver. Не делает git commit/push.
user-invocable: true
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
argument-hint: "<путь к файлу от /mr-analyze> [--marketplace-root <path>]"
---

# /mr-apply

Читает файл, созданный `/mr-analyze`, и применяет каждое предложение к соответствующему `SKILL.md` / `agent.md` / `plugin.json` / `marketplace.json` / `bundle.json`. После применения каждого изменения — self-review по правилам маркетплейса. В конце — `npm run validate`. Файлы остаются в рабочем дереве маркетплейса (uncommitted). На выход — `apply-report.md`.

**Goal:** Готовый diff в маркетплейс-репе + отчёт `apply-report.md` со списком Applied / Skipped (self-review failed) / Failed (validate). Stdout — абсолютный путь к отчёту.

**Input:**

- Абсолютный путь к файлу `/tmp/mr-analyze-*.md`
- Опционально `--marketplace-root <path>` — корень клона `mmx003/claude-code-marketplace`. По умолчанию — текущий cwd. Если в cwd нет `.claude-plugin/marketplace.json`, явная ошибка с инструкцией.

**Constraints:**

- НЕ делать `git commit`, `git push`, `git checkout` — только правка файлов
- НЕ создавать PR
- Каждое применение проходит self-review до записи в файл; провал self-review → пропуск с записью в отчёт
- В конце `npm run validate` обязателен; падение → бинарный поиск виновника + откат → запись в Failed
- Версия плагина обновляется одновременно в `.claude-plugin/plugin.json` И `.claude-plugin/marketplace.json`
