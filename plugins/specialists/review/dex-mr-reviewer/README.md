# dex-mr-reviewer

Языко-агностичный ревьюер чужого MR/PR по рецепту **Reviewer**. Стек определяет по манифестам проекта, ищет не стилистику, а то, что сломается в проде, эксплуатируется или развалится через полгода. Результат доставляется отдельными инлайн-тредами (один тред = одна находка) через канал хостинга: native MCP приоритетом, иначе `gh` или `glab`.

## Команда

`/mr-review <MR/PR url или short-id> [описание задачи]` - точка входа команды в `dex-sdlc`, не в этом плагине. Первичное ревью; платформа определяется по форме ссылки (`owner/repo#N` для GitHub, `group/project!N` для GitLab). Команда вызывает движок `dex-sdlc:engine` и трек `dex-skill-mr-review-track:mr-review-track`, тот делегирует агенту `mr-reviewer` из этого плагина.

## Архитектура

Трек `mr-review-track` делегирует агенту `mr-reviewer` (Context and Diff Capture -> Domain Priming -> Change Map -> Parallel Deep Scan -> Non-Code Audit -> Content-Level Pass -> Falsification and Scoring -> Dedup and Sort -> Cross-Linking and Plan -> Calibration and Labeling -> Report -> Draft Threads -> Publish). Тяжёлые фокусы Phase 3 при крупном diff'е распараллеливаются через `Agent` tool.

Три гейта доставки: отчёт -> `оформляй` (черновики тредов) -> `пушь` (публикация). До `пушь` в MR не пишется ничего, чужие треды не трогаются, approve/unapprove не делается.

## Skills

В Phase 3 агент императивно грузит через Skill tool skills активных осей - ось, которую diff не задевает, не даёт ни фокуса, ни своих skills: `architecture` - `dex-skill-solid`, `dex-skill-clean-architecture`, `dex-skill-ddd`, `dex-skill-microservices`, `dex-skill-nfr`; `security` - `dex-skill-owasp-security`; `performance` - `dex-skill-performance-review`; `testability` - `dex-skill-testability`; `loose-ends` - `dex-skill-no-loose-ends` (по изменённым коду, конфигам, скриптам, CI), и стек-специфичные `dex-skill-dotnet-*` / `dex-skill-react` / `dex-skill-ts-patterns` / `dex-skill-ts-nodejs-api`. Дисциплина и доставка: `dex-skill-review-evidence`, `dex-skill-review-threads`, `dex-skill-output-hygiene`.

## Требования

Канал записи: native MCP хостинга (приоритет) либо фолбэк-CLI `gh` (GitHub) / `glab` (GitLab) с правом писать комментарии. Ни один канал не доступен - агент останавливается на плане тредов.

## Связанные плагины

- `dex-mr-check-reviewer` - следующая ревизия по дельте.
- `dex-review-planner` - план правок на стороне автора.
- `dex-self-reviewer` - саморевью до открытия MR.
