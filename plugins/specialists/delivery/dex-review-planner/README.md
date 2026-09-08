# dex-review-planner

Языко-агностичный планировщик правок по результатам ревью. Собирает полную картину «что изменилось и что ждут» по MR/PR с ревью (своим, чужим или сборным) и составляет точечный план. **Код не правит**: исполнение передаётся отдельному исполнителю или команде `/implement` (плагин `dex-implement`).

## Команда

`/review-plan <MR/PR url или short-id> [REVIEW_SHA]` - точка входа, едет в этом же плагине. Команда ведёт полный цикл план -> правки -> ре-ревью: планирование делегирует этому агенту, правки в код - кодеру стека, ре-ревью - `dex-mr-check-reviewer:mr-check-reviewer`.

## Архитектура

Команда делегирует планирование агенту `review-planner` (Full Context Gather -> Classify Comments -> Verify Actionables -> Assemble Plan -> Draft Replies -> Present and Loop). Учитывается всё, что изменилось с момента ревью: задача, описание MR, код (коммиты автора), другие треды.

Каждый комментарий классифицируется по осям type / actionability / priority / related / task_alignment. Каждое actionable верифицируется чтением кода (комментарий мог устареть после правок) с оценкой blast radius. План группируется P0..P3.

В frontmatter нет `Edit`/`Write` и `Agent`: агент сознательно не трогает код. Цикл: `делай` (передать план в исполнение), `отвечай` (опубликовать reply и resolve). Resolve треда только после reply и подтверждённого фикса.

## Skills

`dex-skill-review-step-by-step` (процесс разбора через апрув), `dex-skill-review-evidence` и `dex-skill-fact-verification` (верификация по коду и техфактов ревьюера), `dex-skill-review-threads` и `dex-skill-output-hygiene` (черновики ответов).

## Связанные плагины

- `dex-mr-check-reviewer` - следующая ревизия ревью после применения правок, та же команда.
