---
description: Применить предложения /mr-analyze к файлам маркетплейса с self-review и валидацией. Bump versions по semver. Не делает git commit/push.
user-invocable: true
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
argument-hint: "<путь к файлу от /mr-analyze> [--marketplace-root <path>]"
---

# /mr-apply

Читает файл, созданный `/mr-analyze`, и применяет каждое предложение к соответствующему `SKILL.md` / `agent.md` / `plugin.json` / `marketplace.json` / `bundle.json`. После применения каждого изменения — self-review по правилам маркетплейса. В конце — `npm run validate`. Файлы остаются в рабочем дереве маркетплейса (uncommitted). На выход — `apply-report.md`.

**Goal:** Готовый diff в маркетплейс-репе + отчёт `apply-report.md` со списком Applied / Skipped (self-review failed) / Failed (validate). Stdout — абсолютный путь к отчёту.

**Input:** абсолютный путь к `/tmp/mr-analyze-*.md`. Опционально `--marketplace-root <path>` — корень клона `mmx003/claude-code-marketplace` (по умолчанию текущий cwd). Если ни там ни там нет `.claude-plugin/marketplace.json` — явная ошибка с инструкцией.

**Constraints:** не делает `git commit/push/checkout` и не создаёт PR — только правка файлов в рабочем дереве. Каждое применение проходит self-review до записи; провал → пропуск в отчёт. В конце обязательный `npm run validate`; падение → откат виновника → запись в Failed. Версия плагина обновляется одновременно в `plugin.json` и `marketplace.json`.

## Типы предложений

Обрабатываем три секции из `/mr-analyze`: `Proposed skill additions`, `Proposed new skills`, `Proposed agent changes`. Секции `Skipped` и `Dropped` игнорируем как уже отброшенные.

### Proposed skill additions

Целевой файл — `plugins/skills/<dex-skill-name>/skills/*/SKILL.md`. Drop-in блок вставляется в указанную H2-секцию (если её нет — создаётся в конце файла). После вставки обязательно: bump minor в `plugin.json` плагина + синхронный bump в `.claude-plugin/marketplace.json`.

### Proposed new skills

Создаются три файла: `SKILL.md` в `plugins/skills/<name>/skills/<name>/`, `plugin.json` в `.claude-plugin/` плагина (version `1.0.0`, author `Dex Team` / email `admin@dex.ru`, license `GPL-3.0`, repository `https://github.com/dex-it/claude-code-marketplace`), новая запись в массив `plugins` корневого `marketplace.json` (version `1.0.0`, `source` указывает на новую директорию). Bundle.json трогаем только если в предложении указаны bundles — иначе оставляем ручному ревьюеру.

### Proposed agent changes

Целевой файл — `plugins/specialists/**/<agent-name>/agents/*.md`. Правки бывают трёх видов: расширение чек-листа фазы (добавить пункт), новая фаза (вставить в правильном месте по рецепту из AGENT_FRAMEWORK.md, mandatory обязательно с «Why mandatory»), дополнительный Skill tool вызов в `Skill-Based Deep Scan`. После правки — bump minor в `plugin.json` + `marketplace.json` specialist'а.

## Self-review каждого применения

Перед записью изменения в файл — проверка по правилам ниже. Любое нарушение → пропуск с записью в `Skipped (self-review failed)` секцию `apply-report.md` с цитатой нарушения.

**Универсальные:** нет запрещённых полей в frontmatter (`skills:` нигде, `allowed-tools:` запрещён в agent.md, `keywords:` запрещён в SKILL.md — пороги синхронизированы с `tools/validate-skill.js` и `tools/validate-agent.js`); нет имён конкретных проектов / классов / DTO в формулировках (например `MerlinService`, `UpCore`, `EyeLineData`). Допустимы имена .NET API (`HttpClient`, `DbContext`, `ServiceCollection`).

**Для skills (синхронизировано с `tools/validate-skill.js`):** размер SKILL.md ≤ 250 строк (`size-exceeds-recommended`), потолок 500 (`size-exceeds-hard-limit`); `description` 50–250 символов; `description` содержит фразу `Активируется при` с ≥ 10 keywords через запятую после неё (`description-no-activation` / `description-few-keywords`); ≥ 5 ловушек H3 на skill (`too-few-traps`); подзаголовок ловушки — `###` внутри H2-категории, не `####`; каждая ловушка содержит триаду «Плохо / Правильно / Почему» (`trap-missing-triad`); ни один code fence не превышает 5 строк (`code-fence-too-long`); нет дублирования с существующими ловушками того же `SKILL.md` (grep по формулировке).

**Для agents:** новая mandatory-фаза без явного «Why mandatory» — пропуск; порядок фаз должен соответствовать рецепту (Domain Priming → Direct Analysis → Skill-Based Scan → Audit → Cross-Linking → Severity → Tech Debt → Output → Report).

**Для plugin.json / marketplace.json:** если применение требует bump (всё кроме pure description fix), но версия не изменена — пропуск с причиной «forgotten bump»; версия в `plugin.json` и `marketplace.json` для одного плагина должна совпадать, иначе пропуск.

## Валидация и rollback

После всех применений обязательный прогон `npm run validate` в `<marketplace-root>`.

**Если PASS** — все применения попадают в секцию `Applied` отчёта. Stdout — путь к отчёту. Конец работы.

**Если FAIL** — цель найти виновное предложение и откатить только его. Стратегия: журнал «было / стало» по каждому применению. Перед каждым применением читается состояние файла `before` и сохраняется в журнал вместе с `proposal_id`. После падения валидатора по stderr извлекается имя файла с ошибкой, в журнале находится последнее применение, тронувшее этот файл, файл возвращается к `before` через Write, валидатор перезапускается. Если падение продолжается на том же файле — откат всех применений по этому файлу. Все откаченные применения попадают в `Failed (validate)` с цитатой ошибки validator'а. Это даёт O(K) откатов, где K — число падений (обычно 1-2).

## Output: `apply-report.md`

Путь: `/tmp/mr-apply-<task-key>-<YYYYMMDD-HHMM>.md`. Task key из имени входного analyze.md (regex `mr-analyze-([A-Z]+-\d+|no-task)-`), иначе `no-task`.

Структура: секция `Metadata` с source analyze, marketplace root, started timestamp, итог validate (PASS/FAIL); секция `Applied (N)` — для каждого применения подзаголовок с именем предложения, поля File / Section / Lines added / Version bump; секция `Skipped (self-review failed) (M)` — подзаголовок предложения, поля Reason (точная цитата нарушенного правила) / Cited (фрагмент из предложения, нарушивший правило) / Action (`Не применено`); секция `Skipped (target not found) (P)` — подзаголовок предложения, поля Target (имя несуществующего skill / агента / bundle) / Reason (`target not found`) / Action (`Не применено -- передать на ручной ревью /mr-analyze для уточнения цели или создания нового плагина`); секция `Failed (validate) (K)` — подзаголовок предложения, поля File / Validator error (stderr цитата) / Action (`Откачено`) / Suggestion for human review.

Если ноль Applied / Skipped / Failed — файл всё равно создаётся, секции содержат `none`.

## Errors

| Сценарий | Действие |
|----------|----------|
| Входной файл не найден | Stderr: «expected /tmp/mr-analyze-*.md», exit 1 |
| Входной файл не от /mr-analyze (нет секций Proposed *) | Stderr: «expected /mr-analyze format», exit 1 |
| `--marketplace-root` указан, но не содержит `.claude-plugin/marketplace.json` | Stderr с инструкцией, exit 1 |
| `--marketplace-root` не указан и текущий cwd не содержит marketplace.json | Stderr с инструкцией, exit 1 |
| `npm` отсутствует в PATH | Stderr: «npm required for validate», exit 1 |
| Целевой skill / агент / bundle из предложения не существует | Записать в `Skipped (target not found)` с причиной `target not found`, продолжить со следующим |
| Все предложения провалили self-review и validate | apply-report.md создаётся, ноль Applied — это валидный исход |
| `npm run validate` падает с не-кодом-ошибки (например `Cannot find module`) | Stderr целиком, exit 1 (не пытаемся откатывать) |
