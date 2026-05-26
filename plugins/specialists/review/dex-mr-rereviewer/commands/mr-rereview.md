---
description: Итеративное ре-ревью дельты MR/PR с прошлого раунда — range-diff, статус прежних находок, новые находки только в дельте
allowed-tools: Read, Grep, Glob, Bash, Skill, Agent
argument-hint: "<MR/PR url или short-id> [LAST_REVIEW_SHA]"
---

# /mr-rereview

Запустить следующий раунд ревью того же MR/PR после правок автора: посмотреть дельту, проверить закрытие прошлых замечаний, поймать новое.

## Goal

Провести MR/PR через фазы агента `mr-rereviewer`: Establish Revisions, Prior Findings Status, Delta Domain Recall, New Findings Hunt, Falsification, Cross-Link and Calibrate, Report, Draft Thread Updates, Publish.

## Input

Аргумент — ссылка на MR/PR или short-id. Опционально LAST_REVIEW_SHA, если sha прошлого раунда не выводится из истории комментариев. Платформа определяется по форме ссылки.

## Output

- Diff-обзор раунда: закрыто, осталось открытым, новых по severity
- Обновлённый verdict и статусы прошлых находок (closed / partial / open / disputed / no-longer-applicable)
- После `оформляй` — план апдейтов тредов и новых тредов
- После `пушь` — опубликованные reply и новые треды через gh/glab API

## Constraints

- Работать по дельте; полный ре-ревью только по явной команде `полный`
- Регрессия от фикса прошлого раунда — severity не ниже HIGH
- Severity прошлых находок не менять без причины из нового кода или ответа автора
- До `пушь` ни одной записи; чужие треды не трогать

Делегировать агенту `mr-rereviewer`.
