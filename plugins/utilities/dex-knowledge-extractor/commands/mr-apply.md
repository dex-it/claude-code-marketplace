---
description: Применить предложения /mr-analyze к файлам маркетплейса с self-review и валидацией. Bump versions по semver. Не делает git commit/push.
user-invocable: true
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
argument-hint: "<путь к файлу от /mr-analyze> [--marketplace-root <path>] [--base <branch>]"
---

# /mr-apply

Читает файл, созданный `/mr-analyze`, и применяет каждое предложение к соответствующему `SKILL.md` / `agent.md` / `plugin.json` / `marketplace.json` / `bundle.json`. В конце — `npm run validate`. Файлы остаются в рабочем дереве маркетплейса (uncommitted). На выход — `apply-report.md`.

**Принцип:** `/mr-apply` не выступает формальным фильтром предложений. Решение «принять / переписать / выкинуть» по существу каждой ловушки — за ревьювером итогового PR. Задача `/mr-apply` — механически развернуть материал из `/mr-analyze` в рабочее дерево и прогнать `npm run validate`. Самопроверка по лимитам валидатора — на стороне `/mr-analyze` (см. Validation constraints там).

**Goal:** Готовый diff в маркетплейс-репе + отчёт `apply-report.md` со списком Applied / Skipped (target not found) / Failed (validate). Stdout — абсолютный путь к отчёту.

**Input:** абсолютный путь к `/tmp/mr-analyze-*.md`. Опционально `--marketplace-root <path>` — корень клона `mmx003/claude-code-marketplace` (по умолчанию текущий cwd). Если ни там ни там нет `.claude-plugin/marketplace.json` — явная ошибка с инструкцией. Опционально `--base <branch>` — целевая ветка авто-PR для обвязки (по умолчанию `develop`; см. «Hotfix escape-hatch»).

**Constraints:** не делает `git commit/push/checkout` и не создаёт PR — только правка файлов в рабочем дереве. В конце обязательный `npm run validate`; падение → откат виновника → запись в Failed. Версия плагина обновляется одновременно в `plugin.json` и `marketplace.json`.

**Базовая ветка для обвязки:** сам `/mr-apply` PR не создаёт, но обвязка (CI / оператор) должна ответвлять `auto/mr-*` от `develop` и открывать PR **в `develop`**, не в `main`: `main` отстаёт, PR в `main` подтянет в diff весь накопленный `develop` — ревью утонет в постороннем коде. Правило пробрасывается в `Metadata` строкой `base branch: develop`.

**Точка контроля и hotfix-escape:** строка `base branch` в `Metadata` — сигнал, не валидатор; обвязка перед открытием PR обязана проверить базу технически — `git merge-base --is-ancestor <base> auto/mr-*`; если `<base>` не предок ветки, PR не открывать, эскалировать оператору. `/mr-apply` сам git не трогает — точка контроля живёт в CI-pipeline (если скрипта пока нет — отдельная задача). Для срочного hotfix в `main` напрямую `/mr-apply` принимает опциональный флаг `--base <branch>` (по умолчанию `develop`): значение пробрасывается в `Metadata` строкой `base branch: <branch>`, обвязка берёт его, а не дефолт.

## Типы предложений

Обрабатываем три секции из `/mr-analyze`: `Proposed skill additions`, `Proposed new skills`, `Proposed agent changes`. Секции `Skipped` и `Dropped` не применяем, но их счётчики пробрасываем в Metadata `apply-report.md` (`analyze_skipped` / `analyze_dropped`) -- чтобы ревьювер PR видел полную картину `/mr-analyze` из одного отчёта.

**Version bump:** для skill additions и agent changes -- bump minor в `plugin.json` плагина + синхронный bump в `.claude-plugin/marketplace.json`. Для new skills -- создаются на `1.0.0` в обоих местах. Если в предложении явно указана старая версия -- `/mr-apply` всё равно поднимает минор сам (это не пропуск, это нормальный ход применения).

**JSON-файлы правятся только точечным `Edit` (критично):** `marketplace.json`, `plugin.json`, `bundle.json` редактируются **исключительно** через `Edit` -- замена конкретной строки `"version": "X"` у нужного плагина, вставка одного нового блока в `plugins[]` / `includes[]`. **Запрещено** перезаписывать файл целиком через `Write` или прогонять через JSON-сериализатор (`jq -S`, `JSON.stringify`, `python json.dump` и т.п.): сериализатор переформатирует **весь** файл (отступ, порядок ключей), раздувая diff на тысячи строк при 2-3 содержательных изменениях -- ревью тонет в whitespace-шуме, теряется видимость реальной правки. Сохранять существующий стиль: отступ `marketplace.json` -- 2 пробела, порядок ключей и кодировку (UTF-8 кириллица в description) не менять. Diff обязан содержать только изменённые строки. Если после применения `git diff <файл>` показывает переформатирование незатронутых записей -- откатить и переписать точечным `Edit`.

### Proposed skill additions

Целевой файл — `plugins/skills/<dex-skill-name>/skills/*/SKILL.md`. Drop-in блок вставляется в указанную H2-секцию (если её нет — создаётся в конце файла). После вставки обязательно: bump minor в `plugin.json` плагина + синхронный bump в `.claude-plugin/marketplace.json`.

**Что копируем в SKILL.md:** только drop-in блок (триада «Плохо/Правильно/Почему» под H3-заголовком). Метаданные предложения из `/mr-analyze` -- **весь блок `Critical assessment` целиком (все поля самооценки as-is + строка Recommendation for reviewer)** -- остаются в `apply-report.md` для ревьювера PR, **в SKILL.md не попадают**. Конкретный состав полей определяет `/mr-analyze` (см. там «Critical assessment per proposal»); `/mr-apply` копирует блок дословно, не выбирая поля.

### Proposed new skills

Создаются три файла: `SKILL.md` в `plugins/skills/<name>/skills/<name>/`, `plugin.json` в `.claude-plugin/` плагина (version `1.0.0`, author `Dex Team` / email `admin@dex.ru`, license `GPL-3.0`, repository `https://github.com/dex-it/claude-code-marketplace`), новая запись в массив `plugins` корневого `marketplace.json` (version `1.0.0`, `source` указывает на новую директорию). Если `/mr-analyze` указал целевой bundle -- добавить имя skill в `includes[]` его `bundle.json` (иначе skill-сирота: в каталоге есть, ни один bundle не тянет). Bundle не указан -- отметить в `apply-report.md`, что привязку к bundle делает ревьюер.

### Proposed agent changes

Целевой файл — `plugins/specialists/**/<agent-name>/agents/*.md`. Правки бывают трёх видов: расширение чек-листа фазы (добавить пункт), новая фаза (вставить в правильном месте по рецепту из AGENT_FRAMEWORK.md, mandatory обязательно с «Why mandatory»), дополнительный Skill tool вызов в `Skill-Based Deep Scan`. После правки — bump minor в `plugin.json` + `marketplace.json` specialist'а.

## Что всё-таки пропускаем

Единственная причина пропуска -- **target not found**: целевой `SKILL.md` / `agent.md` / `bundle.json` из предложения не существует на диске. Это не формальная фильтрация по существу, а реальный факт: применять некуда. В отчёт в секцию `Skipped (target not found)` с причиной и предложением передать `/mr-analyze` на ручной ревью для уточнения цели или создания нового плагина.

## Валидация и rollback

После всех применений обязательный прогон `npm run validate` в `<marketplace-root>`.

**Если PASS** — все применения попадают в секцию `Applied` отчёта. Stdout — путь к отчёту. Конец работы.

**Если FAIL** — цель найти виновное предложение и откатить только его. Стратегия: журнал «было / стало» по каждому применению. Перед каждым применением читается состояние файла `before` и сохраняется в журнал вместе с `proposal_id`. После падения валидатора по stderr извлекается имя файла с ошибкой, в журнале находится последнее применение, тронувшее этот файл, файл возвращается к `before` через Write, валидатор перезапускается. Если падение продолжается на том же файле — откат всех применений по этому файлу. Все откаченные применения попадают в `Failed (validate)` с цитатой ошибки validator'а. Это даёт O(K) откатов, где K — число падений (обычно 1-2).

**Исключение -- новый skill с `too-few-traps`:** если валидатор падает на свежесозданном skill из `Proposed new skills` по причине `too-few-traps` (< 5 ловушек) -- **не откатывать**. Skill создаётся, остаётся в рабочем дереве, попадает в `Applied` с пометкой `validator: too-few-traps -- skill-заготовка, ревьюер добирает ловушки`. Решение за оператором (CLAUDE.md: создание skill -- легитимный исход, нехватка ловушек -- сигнал, не блокер). Прочие ошибки валидатора на новом skill (битый frontmatter, missing-triad) откатываются как обычно. Итог validate в Metadata тогда `FAIL (ожидаемо: new-skill too-few-traps)` -- CI маркетплейса заблокирует авто-PR до доработки, это by design.

## Output: `apply-report.md`

Путь: `/tmp/mr-apply-<task-key>-<YYYYMMDD-HHMM>.md`. Task key из имени входного analyze.md (regex `mr-analyze-([A-Z]+-\d+|no-task)-`), иначе `no-task`.

Структура: секция `Metadata` с source analyze, marketplace root, started timestamp, итог validate (PASS/FAIL), `base branch: <branch>` (целевая ветка PR для обвязки -- значение флага `--base`, по умолчанию `develop`), счётчики `analyze_skipped` / `analyze_dropped` из исходного `/mr-analyze` (ревьюверу PR -- полная картина из одного отчёта); секция `Applied (N)` — для каждого применения подзаголовок с именем предложения, поля File / Section / Lines added / Version bump + **скопированный as-is блок `Critical assessment` из `/mr-analyze` целиком** (все поля самооценки дословно, в том составе, что задаёт `/mr-analyze`, + строка Recommendation for reviewer -- ревьювер PR видит самооценку анализатора прямо в apply-report, не прыгая между файлами; поля не выбираются и не отсеиваются); секция `Skipped (target not found) (P)` — подзаголовок предложения, поля Target (имя несуществующего skill / агента / bundle) / Reason (`target not found`) / Action (`Не применено -- передать на ручной ревью /mr-analyze для уточнения цели или создания нового плагина`); секция `Failed (validate) (K)` — подзаголовок предложения, поля File / Validator error (stderr цитата) / Action (`Откачено`) / Suggestion for human review (включая ссылку на правило валидатора, например `code-fence-too-long` / `trap-missing-triad` -- чтобы ревьюверу PR было понятно, на что смотреть в `/mr-analyze`).

Если ноль Applied / Skipped / Failed — файл всё равно создаётся, секции содержат `none`.

**Тело авто-PR для обвязки:** `apply-report.md` остаётся файлом в `/tmp` и **не прикладывается** к авто-PR целиком. В тело PR обвязка кладёт только краткую сводку — счётчики `Applied` / `Skipped` / `Failed`, итог `validate`, `base branch`; полный отчёт (блоки `Critical assessment`, цитаты ошибок) в описание не вставляется, иначе ревью тонет в метаданных. Полный отчёт оператор берёт из `/tmp` по пути из stdout.

## Errors

| Сценарий | Действие |
|----------|----------|
| Входной файл не найден | Stderr: «expected /tmp/mr-analyze-*.md», exit 1 |
| Входной файл не от /mr-analyze (нет секций Proposed *) | Stderr: «expected /mr-analyze format», exit 1 |
| `--marketplace-root` указан, но не содержит `.claude-plugin/marketplace.json` | Stderr с инструкцией, exit 1 |
| `--marketplace-root` не указан и текущий cwd не содержит marketplace.json | Stderr с инструкцией, exit 1 |
| `npm` отсутствует в PATH | Stderr: «npm required for validate», exit 1 |
| Целевой skill / агент / bundle из предложения не существует | Записать в `Skipped (target not found)` с причиной `target not found`, продолжить со следующим |
| Все предложения провалили validate | apply-report.md создаётся, ноль Applied — это валидный исход; ревьювер PR смотрит секцию `Failed (validate)` и решает по существу |
| `npm run validate` падает с не-кодом-ошибки (например `Cannot find module`) | Stderr целиком, exit 1 (не пытаемся откатывать) |
