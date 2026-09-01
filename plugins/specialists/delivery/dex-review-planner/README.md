# dex-review-planner

Языко-агностичный планировщик правок по результатам ревью. Собирает полную картину «что изменилось и что ждут» по MR/PR с ревью (своим, чужим или сборным) и составляет точечный план. **Код не правит**: исполнение передаётся отдельному исполнителю или через `dex-sdlc`/`dex-skill-development-track` (`/implement`).

## Команда

`/review-plan <MR/PR url или short-id> [REVIEW_SHA]` - точка входа команды в `dex-sdlc`, не в этом плагине. Команда вызывает движок `dex-sdlc:engine` и трек `dex-skill-followup-track:followup-track`, который ведёт полный цикл план -> правки -> ре-ревью (правки в код делают исполняющие узлы трека, не этот агент).

## Архитектура

Трек `followup-track` делегирует планирование агенту `review-planner` (Full Context Gather -> Classify Comments -> Verify Actionables -> Assemble Plan -> Draft Replies -> Present and Loop). Учитывается всё, что изменилось с момента ревью: задача, описание MR, код (коммиты автора), другие треды.

Каждый комментарий классифицируется по осям type / actionability / priority / related / task_alignment. Каждое actionable верифицируется чтением кода (комментарий мог устареть после правок) с оценкой blast radius. План группируется P0..P3.

В frontmatter нет `Edit`/`Write` и `Agent`: агент сознательно не трогает код. Цикл: `делай` (передать план в исполнение), `отвечай` (опубликовать reply и resolve). Resolve треда только после reply и подтверждённого фикса.

## Skills

`dex-skill-review-step-by-step` (процесс разбора через апрув), `dex-skill-review-evidence` и `dex-skill-fact-verification` (верификация по коду и техфактов ревьюера), `dex-skill-review-threads` и `dex-skill-output-hygiene` (черновики ответов).

## Связанные плагины

- `dex-skill-followup-track` - трек, ведущий цикл этого агента от плана до ре-ревью.
- `dex-mr-check-reviewer` - следующая ревизия ревью после применения правок, тот же трек.
