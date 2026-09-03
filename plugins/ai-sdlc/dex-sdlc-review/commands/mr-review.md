---
description: Ревью входящего MR/PR через движок и mr-review-track - первичная ревизия агентом mr-reviewer, повторные ревизии после правок автора агентом mr-check-reviewer, доставка инлайн-тредами
allowed-tools: Read, Edit, Write, Bash, Grep, Glob, Skill
argument-hint: "<MR/PR url или short-id> [описание задачи] [LAST_REVIEW_SHA для повторной ревизии]"
---

# /mr-review

Провести чужой merge request или pull request через `dex-skill-mr-review-track:mr-review-track`: от
сбора контекста до публикации находок инлайн-тредами, включая повторные ревизии после правок автора.

## Goal

Первый вызов на MR - трек делегирует `mr-reviewer` (Context and Diff Capture, Domain Priming, Change
Map, Parallel Deep Scan, Non-Code Audit, Content-Level Pass, Falsification and Scoring, Dedup and
Sort, Cross-Linking and Plan, Calibration and Labeling, Report, Draft Threads, Publish). Тот же MR
после правок автора - движок возобновляет цикл по auto-ledger, трек делегирует ре-ревью дельты
`mr-check-reviewer` (range-diff, статус прежних находок, новые находки только в дельте), не
первичному ревьюеру заново.

## Input

Аргумент - ссылка на MR/PR или short-id (`owner/repo#N` для GitHub, `group/project!N` для GitLab).
Опционально текст задачи для сверки success criteria (первая ревизия) или `LAST_REVIEW_SHA`, если sha
прошлой ревизии не выводится из истории комментариев (повторная ревизия). Платформа определяется по
форме ссылки.

## Output

- Verdict (APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION) и overview со счётчиком меток
- Сгруппированные находки с severity, confidence, scope и метками
- Повторная ревизия: diff-обзор - закрыто / осталось открытым / новое по severity, статусы прежних
  находок (closed / partial / open / disputed / no-longer-applicable)
- После команды `оформляй` - план инлайн-тредов (file:line, severity, заголовок) либо апдейтов
- После команды `пушь` - опубликованные треды/reply через канал хостинга (native MCP, иначе gh/glab)

## Constraints

- До команды `пушь` ни одной записи в MR; чужие треды не трогать, approve/unapprove не делать
- Находка снимается только опровержением; низкий confidence уводит её в блок «перепроверить»
- Повторная ревизия работает по дельте; полный ре-ревью только по явной команде `полный`
- Регрессия от фикса прошлой ревизии - severity не ниже HIGH; severity прежних находок не менять без
  причины из нового кода или ответа автора
- На ошибку публикации на любом канале - стоп и доклад, без отката на один общий комментарий

Вызови `Skill` -> `dex-sdlc:engine` (откроет/возобновит цикл, авто-ledger с треком
`dex-skill-mr-review-track:mr-review-track`), затем `Skill` -> `dex-skill-mr-review-track:mr-review-track`
с **`mode: interactive`** - без этого поля трек берёт автономную планку (`autonomous`) и цикла
команд (`оформляй`/`пушь`/`полный`) не будет: канал у тела команды есть, спрашивать по нему трек
будет только с этим полем.
