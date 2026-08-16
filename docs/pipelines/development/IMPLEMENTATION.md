# Конвейер разработки: чем исполняется

Состав реализации зоны 3: какими командами она запускается, кто выполняет шаги, где лежит знание.
Устройство работы - в [PIPELINE.md](PIPELINE.md), карта слотов - в
[../../DEV_PROCESS_COVERAGE.md](../../DEV_PROCESS_COVERAGE.md).

## Команды зоны

| Шаг | Команда | Плагин | Что на выходе |
|---|---|---|---|
| Реализация | `/implement` | `dex-skill-autonomous-task` | локальные коммиты, покрытие требований, branch coverage по diff-scope, `auto-ledger` сведён |
| Саморевью | `/self-review` | `dex-self-reviewer` | находки + run-status build/test/lint, рекомендация push |
| Security | `/security-scan` | `dex-security-reviewer` | attack paths, severity; проход отдельный |
| Интеграция с базой | `/resolve-conflicts` | `dex-conflict-resolver` | база подтянута, конфликты разведены без тихой потери стороны |
| Закрытие ветки | `/develop-finish` | `dex-branch-closer` | база подтянута, прогон на слитом состоянии, коммиты, push, MR, трекер |

`/implement` живёт в плагине **движка**, а не у исполнителя: команда - вход в оркестратор, а
оркестратор здесь - process-skill, который агентом быть не может (ведёт тасклист сессии и переживает
компакт). Это именованное исключение из общего запрета «команда не грузит skill» - три условия
исключения в [../../COMMAND_FRAMEWORK.md](../../COMMAND_FRAMEWORK.md).

## Узлы

| Роль | Узел | Замечание |
|---|---|---|
| движок зоны | `dex-skill-autonomous-task:autonomous-task`, трек `development` | дом порядка работ, критерия «готово» и границ сдачи |
| код под стек | `dotnet-coder`, `ts-fullstack-assistant` | выбираются движком по манифестам проекта |
| код без своего кодера | `feature-implementer` | языко-агностичный узел слота «Код», финиш на локальных коммитах |
| тесты под стек | `dotnet-test-writer`, `ts-test-writer` | TDD-слот трека |
| саморевью | `self-reviewer` | закрывает прогон, ревью кода и арх-ревью одним узлом |
| security | `security-reviewer` | отдельный обязательный проход |
| интеграция базы | `conflict-resolver` | вызывается закрытием, тип узла - интегратор, не coder |
| закрытие ветки | `branch-closer` | Operator: Diagnose -> Branch -> Execute -> Verify |

## Скиллы-нормативы

| Что нормирует | Скилл |
|---|---|
| порядок работ зоны, треки, стоп-линия, фиксация неуверенности | `dex-skill-autonomous-task:autonomous-task` (process) |
| контракт стыка узлов, режимы, транспорт артефакта | `dex-skill-node-contract:node-contract` (process) |
| что значит «разработка в ветке закрыта» | `dex-skill-branch-closure:branch-closure` (process) |
| где в проекте лежат требования, ADR, спеки | `dex-skill-project-docs-map:project-docs-map` (process) |
| конвенция коммитов и опасные git-операции | `dex-skill-git-workflow:git-workflow` |

## Носитель состояния

`auto-ledger` движка - вне рабочего дерева (`<config>/projects/<slug>/auto-ledger/<TASK>.md`), в git
не попадает по построению. В `interactive` несёт вторую роль - состояние между командами цепочки:
допущения, run-status, покрытие требований, незакрытые находки и вердикты проходов пишутся туда в
момент получения, следующая команда читает их оттуда.

Документация задачи в проекте (`docs/<TASK>/`) - другая сущность: она в git и едет с MR.

## Бандлы

Плагины зоны ставятся набором `dex-bundle-sdlc` (полный конвейер) либо `dex-bundle-code-review`
(ревью и доставка). Бандл обязан быть замкнут по скиллам своих агентов - проверяет
`npm run validate:bundles`, правило `bundle-not-closed`.
