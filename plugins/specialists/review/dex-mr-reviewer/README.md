# dex-mr-reviewer

Языко-агностичный ревьюер чужого MR/PR по рецепту **Reviewer**. Стек определяет по манифестам проекта, ищет не стилистику, а то, что сломается в проде, эксплуатируется или развалится через полгода. Результат доставляется отдельными инлайн-тредами (один тред = одна находка) через `gh` или `glab`.

## Команда

`/mr-review <MR/PR url или short-id> [описание задачи]` - первичное ревью. Платформа определяется по форме ссылки (`owner/repo#N` для GitHub, `group/project!N` для GitLab).

## Архитектура

Команда `/mr-review` тонкая и делегирует агенту `mr-reviewer` (12 фаз: Context and Diff Capture -> Domain Priming -> Change Map -> Parallel Deep Scan -> Non-Code Audit -> Falsification -> Filter -> Cross-Linking -> Severity Calibration -> Report -> Draft Threads -> Publish). Тяжёлые фокусы Phase 3 при крупном diff'е распараллеливаются через `Agent` tool.

Три гейта доставки: отчёт -> `оформляй` (черновики тредов) -> `пушь` (публикация). До `пушь` в MR не пишется ничего, чужие треды не трогаются, approve/unapprove не делается.

## Skills

В Phase 3 агент императивно грузит через Skill tool релевантные стеку skills: всегда `dex-skill-solid`, `dex-skill-owasp-security`, `dex-skill-testability`, `dex-skill-no-loose-ends`; условно по diff - `dex-skill-clean-architecture`, `dex-skill-ddd`, `dex-skill-microservices`, `dex-skill-nfr`, и стек-специфичные `dex-skill-dotnet-*` / `dex-skill-react` / `dex-skill-typescript-patterns` / `dex-skill-nodejs-api`. Дисциплина и доставка: `dex-skill-review-evidence`, `dex-skill-review-threads`, `dex-skill-output-hygiene`.

## Требования

`gh` (GitHub) или `glab` (GitLab) с правом писать комментарии. Без прав агент останавливается на плане тредов.

## Связанные плагины

- `dex-mr-check-reviewer` - следующий раунд по дельте.
- `dex-review-planner` - план правок на стороне автора.
- `dex-self-reviewer` - саморевью до открытия MR.
