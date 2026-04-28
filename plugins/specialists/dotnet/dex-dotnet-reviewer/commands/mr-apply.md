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

## Типы предложений

Обрабатываем три секции из `/mr-analyze`: `Proposed skill additions`, `Proposed new skills`, `Proposed agent changes`. Секции `Skipped` и `Dropped` игнорируем как уже отброшенные.

### Proposed skill additions

Целевой файл — `plugins/skills/<dex-skill-name>/skills/*/SKILL.md`. Drop-in блок вставляется в указанную H2-секцию (если её нет — создаётся в конце файла). После вставки обязательно: bump minor в `plugin.json` плагина + синхронный bump в `.claude-plugin/marketplace.json`.

### Proposed new skills

Создаются три файла: `SKILL.md` в `plugins/skills/<name>/skills/<name>/`, `plugin.json` в `.claude-plugin/` плагина (version `1.0.0`, author `Maxim Tonkoglas`, license `MIT`), новая запись в массив `plugins` корневого `marketplace.json` (version `1.0.0`, `source` указывает на новую директорию). Bundle.json трогаем только если в предложении указаны bundles — иначе оставляем ручному ревьюеру.

### Proposed agent changes

Целевой файл — `plugins/specialists/**/<agent-name>/agents/*.md`. Правки бывают трёх видов: расширение чек-листа фазы (добавить пункт), новая фаза (вставить в правильном месте по рецепту из AGENT_FRAMEWORK.md, mandatory обязательно с «Why mandatory»), дополнительный Skill tool вызов в `Skill-Based Deep Scan`. После правки — bump minor в `plugin.json` + `marketplace.json` specialist'а.

## Self-review каждого применения

Перед записью изменения в файл — проверка по правилам ниже. Любое нарушение → пропуск с записью в `Skipped (self-review failed)` секцию `apply-report.md` с цитатой нарушения.

**Универсальные:** длина SKILL.md в [80..250] строк; frontmatter `description` ≤ 250 символов; нет запрещённых полей (`skills:` нигде, `allowed-tools:` запрещён в agent.md); нет имён конкретных проектов / классов / DTO в формулировках (например `MerlinService`, `UpCore`, `EyeLineData`). Допустимы имена .NET API (`HttpClient`, `DbContext`, `ServiceCollection`).

**Для skills:** подзаголовок ловушки — `####` внутри H2-секции; формат «Плохо / Правильно / Почему» обязательны все три части; нет дублирования с уже существующими ловушками в том же `SKILL.md` (grep по ключевым словам формулировки).

**Для agents:** новая mandatory-фаза без явного «Why mandatory» — пропуск; порядок фаз должен соответствовать рецепту (Domain Priming → Direct Analysis → Skill-Based Scan → Audit → Cross-Linking → Severity → Tech Debt → Output → Report).

**Для plugin.json / marketplace.json:** если применение требует bump (всё кроме pure description fix), но версия не изменена — пропуск с причиной «forgotten bump»; версия в `plugin.json` и `marketplace.json` для одного плагина должна совпадать, иначе пропуск.
