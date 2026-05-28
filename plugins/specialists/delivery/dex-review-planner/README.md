# dex-review-planner

Языко-агностичный планировщик правок по результатам ревью. Собирает полную картину «что изменилось и что ждут» по MR/PR с ревью (своим, чужим или сборным) и составляет точечный план. **Код не правит**: исполнение передаётся отдельному исполнителю или агенту `dex-feature-implementer`.

## Команда

`/review-plan <MR/PR url или short-id> [REVIEW_SHA]` - план правок и черновики ответов.

## Архитектура

Команда делегирует агенту `review-planner` (Full Context Gather -> Classify Comments -> Verify Actionables -> Assemble Plan -> Draft Replies -> Present and Loop). Учитывается всё, что изменилось с момента ревью: задача, описание MR, код (коммиты автора), другие треды.

Каждый комментарий классифицируется по осям type / actionability / priority / related / task_alignment. Каждое actionable верифицируется чтением кода (комментарий мог устареть после правок) с оценкой blast radius. План группируется P0..P3.

В frontmatter нет `Edit`/`Write` и `Agent`: агент сознательно не трогает код. Цикл: `делай` (передать план в исполнение), `отвечай` (опубликовать reply и resolve). Resolve треда только после reply и подтверждённого фикса.

## Skills

`dex-skill-review-step-by-step` (процесс разбора через апрув), `dex-skill-review-evidence` (верификация по коду), `dex-skill-review-threads` и `dex-skill-output-hygiene` (черновики ответов).

## Связанные плагины

- `dex-feature-implementer` - исполнение плана правок до локальных коммитов.
- `dex-mr-check-reviewer` - следующий раунд ревью после применения правок.
