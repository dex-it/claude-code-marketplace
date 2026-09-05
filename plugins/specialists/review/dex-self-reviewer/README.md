# dex-self-reviewer

Языко-агностичное pre-push саморевью своей локальной ветки. Ловит то, что иначе ловит CI, ревьюер, прод или клиент. Ничего не публикуется наружу: output это чеклист для автора. Незакоммиченные изменения (staged и worktree) ревьюятся наравне с закоммиченными.

## Команда

`/self-review [base-branch]` - саморевью текущей ветки. База по умолчанию определяется по upstream (`origin/main` или `origin/develop`).

## Архитектура

Команда делегирует агенту `self-reviewer` (Capture Diffs -> Domain Recall -> Change Map -> Parallel Focus Scan -> Falsification -> Assemble Findings -> Report). Захватываются три слоя: committed, staged, worktree.

Состав осей определяется характером diff: ось, которую изменение не задевает, не проходится и получает исход `n/a` с основанием. Два фокуса безусловны. **Local verification** не читает код, а реально запускает команды проекта (build, типы, линтер, тесты, audit) и прикладывает фактический вывод; упавшая команда это объективная находка CRITICAL/HIGH. **Loose ends and hacks** - отдельный критичный проход на недоделки (дефолт severity HIGH), незавершёнка от темы изменения не зависит.

Цикл: автор правит по чеклисту и говорит `делай` (исправить), `ещё раз` (новый проход по дельте) или `пушь`. Push разрешается только при зелёном Local verification и отсутствии 🔴; незакоммиченный worktree перед push выносится явно.

## Skills

Тематические skills грузятся по активным осям (solid, owasp-security, performance-review, testability, clean-architecture, ddd, microservices, nfr и др.): ось не задета diff'ом - её skill не грузится. Профильные по стеку - через реестр `dex-skill-stack-registry` (единый способ для всех языко-агностичных агентов). `dex-skill-no-loose-ends` (ядро фокуса loose-ends) поднимают изменённые код, конфиги, скрипты или CI. Дисциплина фаз: `dex-skill-review-evidence`, `dex-skill-output-hygiene`.

## Связанные плагины

- `/implement` через `dex-sdlc` и `dex-skill-development-track` - реализация фичи; следующий шаг - это саморевью.
- `dex-mr-reviewer` - ревью уже на стороне другого человека после открытия MR.
