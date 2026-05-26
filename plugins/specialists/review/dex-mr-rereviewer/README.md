# dex-mr-rereviewer

Языко-агностичное итеративное ре-ревью того же MR/PR после правок автора. Не переревьюивает весь MR: работает по дельте с момента прошлого раунда, проверяет закрытие прошлых замечаний и ловит новое в дельте, включая регрессии от самих фиксов.

## Команда

`/mr-rereview <MR/PR url или short-id> [LAST_REVIEW_SHA]` — следующий раунд ревью. LAST_REVIEW_SHA опционален, если sha прошлого раунда не выводится из истории комментариев.

## Архитектура

Команда делегирует агенту `mr-rereviewer` (Establish Revisions -> Prior Findings Status -> Delta Domain Recall -> New Findings Hunt -> Falsification -> Cross-Link and Calibrate -> Report -> Draft Thread Updates -> Publish). Источник правды дельты — `git range-diff BASE LAST_REVIEW HEAD` (учитывает rebase/squash) плюс плоская дельта.

Каждой прошлой находке присваивается статус: closed / partial / open / disputed / no-longer-applicable. Свои прошлые треды апдейтятся reply'ями; чужие не трогаются. Гейты `оформляй` и `пушь`, как в первичном ревью.

## Skills

Условная загрузка как в `dex-mr-reviewer`, плюс `dex-skill-git-workflow` (range-diff, привязка к ревизии), `dex-skill-review-evidence`, `dex-skill-review-threads`, `dex-skill-output-hygiene`.

## Связанные плагины

- `dex-mr-reviewer` - первичный раунд того же MR.
- `dex-review-planner` - план правок на стороне автора.
