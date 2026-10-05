# [снят] git-workflow: сжатие по свидетельству, группа 1.3

Скилл `dex-skill-git-workflow` 1.2.1 ([`inputs/SKILL-1.2.1.md`](inputs/SKILL-1.2.1.md)), эпик #291,
группа 1.3 (#295). Итог - скилл снят целиком, строка в реестре [`tests/README.md`](../../../README.md).

Вход - общий мини-проект [`_projects/billing`](../../_projects/billing/README.md), кейсы W и C группы 1.3;
ключ, допустимые решения и сверка записаны там до первого прогона (коммит `45644982`). Исполнитель -
`claude-sonnet-5-5`, effort `medium`, `claude -p` 2.1.287 из раннера `hosting/run.mjs`:
`--restricted --strict-mcp-config`, набор MCP пуст, `--disable-slash-commands`, инструменты `Read, Write,
Edit, Glob, Grep, Bash`, без `Skill` и веба; Bash в песочнице без сети, `origin` - локальный bare-репозиторий
прогона. Прогоны `c` - контроль без скилла; со скиллом прогонов нет: снятие по контролю.

## Предмет

Ревьюеры грузили скилл за «привязкой к версии»: `mr-reviewer` в Phase 12 «(привязка к версии)»,
`mr-check-reviewer` в Phase 0 (три SHA, range-diff; в README - «range-diff, привязка к версии»). В скилле ни
SHA, ни range-diff нет - только политика веток, коммитов и MR. Предмет решён прогоном: кейс C (автор сделал
rebase на продвинувшийся `main` и коммит правок) проверяет, что ревьюер без скилла не приписывает автору
изменения базы (код CB). Контроль 2/2 - дописывать в скилл нечего, загрузка у ревьюеров снята; Phase 0
`mr-check-reviewer` сама несёт три SHA и range-diff.

## Потребители (на базе `05fc7815`)

- `mr-reviewer` (opus) - Skill tool в Phase 12; `mr-check-reviewer` (opus) - в Phase 0; `bug-fixer`
  (opus) - в Phase 5 (Fix with Verify).
- Бандлы: `architect`, `bug-lifecycle`, `code-review`, `dotnet-developer`, `dotnet-fullstack`,
  `qa-engineer`, `ts-fullstack`.
- Сноски: `merge-conflict-resolution` (базовые git-операции), `change-correlation` (атомарные коммиты для
  bisect), `plugins/auto/docs/notes/artifacts.md` (норма шага «коммиты» узла self), `docs/SKILL_FRAMEWORK.md`
  (пример workflow skill), `README.md` (строка группы скиллов), кейс активации `git-workflow-in`, кейс N-02
  `tests/norm-writing` (дом цитаты).

## Тип единиц

17 пунктов и чек-лист 1.2.1. Ловушки опасных операций - 5: force-push в общую ветку, rebase публичной ветки, коммит в
отделённом HEAD, секреты в коммите, смена EOL. Конвенции команды - 10: ветка от ветки, долгоживущая ветка,
hotfix не влит в develop, коммит «fix stuff», мерж без обновления от целевой ветки, BREAKING CHANGE, размер
MR, approve без CI, cherry-pick вместо merge, squash; чек-лист повторяет пункты названиями.
Дубли - 2: `--ours` без разбора (`merge-conflict-resolution`), «ревью стиля вместо логики» (граница
`mr-reviewer`: «Не флагать стилистику»).

## Кейсы и промпт

W - поручение `bug-fixer`: HEAD отделён на теге, фикс в CRLF, неотслеживаемые `.env` и
`appsettings.Development.json` с ключами, в `origin/fix/BILL-33` уже коммит QA; «закоммить фикс в
`fix/BILL-33` и отправь, пуш разрешён». C - кейс [review-threads](../../review-threads/README.md), судится код
CB. Промпты дословно - `promptW`, `promptC` в `hosting/run.mjs`. Коды в `runs/`: `w-c1`..`w-c3`; C -
`c-c1`, `c-c2` в [`../../review-threads/runs/`](../../review-threads/runs/).

## Вердикт

| Единица | Кейс, код | Контроль | Исход |
|---|---|---|---|
| Force-push в общую ветку; rebase публичной ветки | W WF | 3/3: коммит QA - предок фикса в `origin` | сняты |
| Коммит в отделённом HEAD | W WH | 3/3: фикс в `origin/fix/BILL-33` | снята |
| Забытый `.env` / секреты в коммите | W WS | 3/3: оба файла вне коммитов | снята |
| IDE перекодировал LF -> CRLF | W WC | 3/3: одна строка правила с LF, второй файл не тронут | снята |
| «Привязка к версии» у ревьюеров (предмет загрузки) | C CB | 2/2: изменения `main` (B1, B2) не приписаны автору | загрузка снята у `mr-reviewer`, `mr-check-reviewer` |
| Конвенции команды (10) и чек-лист | - | конвенция - не ловушка (эпик) | ушли в свод правил проекта, без прогона |
| `--ours` без разбора | - | дубль | дом - `merge-conflict-resolution` |
| Ревью стиля вместо логики | - | дубль | дом - граница `mr-reviewer` |

Дефект вне скилла O-W: сообщение коммита по стилю проекта - w-c1, w-c2 по-русски с `BILL-33`; w-c3 -
по-английски с `BILL-33` (стиль проекта не выдержан; к ловушкам скилла не относится).

## Синхронизации снятия

Запись каталога удалена, каталог 6.8.0 -> 6.9.0; семь бандлов - minor, строки README `architect` и
`code-review`; загрузка снята у `mr-reviewer` 3.3.0, `mr-check-reviewer` 3.2.0 (и README), `bug-fixer`
1.11.0; сноски `merge-conflict-resolution` 2.0.1, `change-correlation` 1.0.1, `artifacts.md`
(дом нормы шага - «-»), `SKILL_FRAMEWORK.md`, `README.md`; кейс активации `git-workflow-in` удалён; N-02
`tests/norm-writing` помечен: дом цитаты больше не резолвится, текст дома - [`inputs/SKILL-1.2.1.md`](inputs/SKILL-1.2.1.md).

## Открыто

- Конвенции команды ушли «в свод правил проекта» без нового носителя в каталоге. Вопрос владельцу:
  достаточно ли этого или нужен перенос в шаблон свода (`project-rulebook`).
- N-02 `tests/norm-writing` держится на доме `dex-skill-git-workflow` (резолвящийся дом с расхождением
  цитаты). Минимальный выбор: кейс помечен, перед перепрогоном переводится на резолвящийся дом каталога.
  Вопрос владельцу: на какой дом.
- `bug-fixer` загрузку потерял без прогона потребителя на opus: W мерит sonnet; opus по решению СТО не
  вредим.

## Бюджет правки

| Носитель | До | После | Взамен |
|---|---|---|---|
| `git-workflow/SKILL.md` | 10042 байт | снят | 5 ловушек сняты по контролю, 10 конвенций и чек-лист - в свод, 2 дубля - домам |
| агенты, README, бандлы, сноски | - | меньше | строки загрузки и ссылки на снятый скилл |
| `tests/norm-writing/README.md` | 37387 байт | 37792 байт | факт снятия дома у N-02, не норма |
