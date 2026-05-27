---
description: Первичное ревью чужого MR/PR - карта изменений, параллельные фокусы, фальсификация, доставка инлайн-тредами через gh/glab
allowed-tools: Read, Grep, Glob, Bash, Skill
argument-hint: "<MR/PR url или short-id> [описание задачи]"
---

# /mr-review

Запустить первичное ревью чужого merge request или pull request: от сбора контекста до публикации находок инлайн-тредами.

## Goal

Провести MR/PR через фазы агента `mr-reviewer`: Context and Diff Capture, Domain Priming, Change Map, Parallel Deep Scan, Non-Code Audit, Content-Level Pass, Falsification, Filter, Cross-Linking, Severity Calibration, Tech Debt Classification, Systemic vs Specific, Output Labeling, Report, Draft Threads, Publish.

## Input

Аргумент - ссылка на MR/PR или short-id (`owner/repo#N` для GitHub, `group/project!N` для GitLab). Опционально текст задачи или ссылка на тикет для сверки success criteria. Платформа определяется по форме ссылки.

## Output

- Verdict (APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION) и overview со счётчиком меток
- Сгруппированные находки с severity, confidence, scope и метками 🟢🟡🟠🔴🟣
- После команды `оформляй` - план инлайн-тредов (file:line, severity, заголовок)
- После команды `пушь` - опубликованные треды через gh/glab API

## Constraints

- До команды `пушь` ни одной записи в MR; чужие треды не трогать, approve/unapprove не делать
- Находки с confidence ниже 80 в основной список не попадают
- Один тред равен одной находке с привязкой к строке; общий комментарий только как overview
- На ошибку API публикации - стоп и доклад, без отката на один общий комментарий

Делегировать агенту `mr-reviewer`.
