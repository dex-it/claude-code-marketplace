# dex-self-reviewer

Языко-агностичное pre-push саморевью своей локальной ветки. Ловит то, что иначе ловит CI, ревьюер, прод или клиент. Ничего не публикуется наружу: output это чеклист для автора. Незакоммиченные изменения (staged и worktree) ревьюятся наравне с закоммиченными.

## Команда

`/self-review [base-branch]` - саморевью текущей ветки. База по умолчанию определяется по upstream (`origin/main` или `origin/develop`).

## Архитектура

Команда делегирует агенту `self-reviewer` (Capture Diffs -> Domain Recall -> Change Map -> Parallel 7-Focus Scan -> Falsification -> Assemble Round -> Report). Захватываются три слоя: committed, staged, worktree.

Седьмой фокус - **Local verification** - не читает код, а реально запускает команды проекта (build, типы, линтер, тесты, audit) и прикладывает фактический вывод; упавшая команда это объективная находка CRITICAL/HIGH. Шестой фокус - **Loose ends and hacks** - отдельный критичный проход на недоделки (дефолт severity HIGH).

Цикл: автор правит по чеклисту и говорит `делай` (исправить), `ещё раз` (новый проход по дельте) или `пушь`. Push разрешается только при зелёном Local verification и отсутствии 🔴; незакоммиченный worktree перед push выносится явно.

## Skills

Тематические skills грузятся условно по содержимому diff (solid, owasp-security, testability, clean-architecture, ddd, microservices, nfr и др.); профильные по стеку — через реестр `dex-skill-stack-registry` (единый способ для всех языко-агностичных агентов). Плюс всегда `dex-skill-no-loose-ends` (ядро фокуса loose-ends), `dex-skill-review-evidence`, `dex-skill-git-workflow`, `dex-skill-output-hygiene`.

## Связанные плагины

- `dex-feature-implementer` - реализация фичи; следующий шаг - это саморевью.
- `dex-mr-reviewer` - ревью уже на стороне другого человека после открытия MR.
