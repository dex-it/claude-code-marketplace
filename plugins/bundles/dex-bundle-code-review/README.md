# Bundle: dex-bundle-code-review

Bundle для полного цикла работы с кодом, языко-агностично: реализация фичи по ТЗ, интеграция базовой ветки с разрешением конфликтов merge/rebase, pre-push саморевью, ревью чужого MR/PR, итеративное ре-ревью дельты, план правок по ревью. Плюс skills дисциплины ревью и реализации.

Цикл замыкается так: `/implement` (реализация до локальных коммитов; баг-фикс - тот же вход, root cause делегируется `dex-debugger`) -> `/resolve-conflicts` (подтянуть базу и развести конфликты merge/rebase) -> `dex-self-reviewer` (саморевью перед push) -> push и открытие MR -> `dex-mr-reviewer` (ревью на стороне ревьюера) -> автор правит -> `dex-mr-check-reviewer` (ре-ревью дельты) и `dex-review-planner` (план правок на стороне автора).

## Installation

```bash
# Linux / macOS / WSL
./install-bundle/install-bundle.sh code-review

# Windows (PowerShell)
.\install-bundle\install-bundle.ps1 code-review

# Preview what will be installed
./install-bundle/install-bundle.sh code-review --dry-run
```

## Uninstallation

```bash
# Linux / macOS / WSL
./install-bundle/uninstall-bundle.sh code-review

# Windows (PowerShell)
.\install-bundle\uninstall-bundle.ps1 code-review
```

## Included Components

Полный состав - `bundle.json`: `includes[]` (профиль роли) плюс `dependencies[]` (подтянутое замыканием); ниже - ключевые компоненты роли, не весь перечень.

### Команды
- `dex-implement` - вход `/implement` (реализация фичи до локальных коммитов, кодер по манифесту репозитория)
- `dex-test` - вход `/test` (добор покрытия по осям матрицы)
- `dex-bug-finder` - вход `/find-bugs` (активный поиск дефектов)
- `dex-stand-reviewer` - вход `/review-stand` (приёмка на стенде)
- `dex-incident-investigator` - вход `/investigate`, `dex-debugger` - вход `/root-cause` (диагностика). Команды зон требований, дизайна и документации в этот bundle не входят - их плагины ставятся отдельно

### Specialists
- `dex-mr-reviewer` - первичное ревью чужого MR/PR, инлайн-треды через gh/glab (`/mr-review`)
- `dex-mr-check-reviewer` - итеративное ре-ревью дельты с прошлой ревизии (вторая ревизия `/mr-review`, не своя команда)
- `dex-review-planner` - план правок по ревью без редактирования кода (`/review-plan`)
- `dex-self-reviewer` - pre-push саморевью своей ветки с реальным прогоном тестов (`/self-review`)
- `dex-debugger` - root cause по коду (`/root-cause`), вызывается и при баг-фиксе через `/implement`

### Skills, новые в этом bundle
- `dex-skill-no-loose-ends` - незавершённый код и скрытые хаки (TODO, заглушки, fallback, secrets)
- `dex-skill-review-evidence` - доказательность находок, фальсификация, рубрики severity/confidence
- `dex-skill-review-threads` - инлайн-доставка ревью, один тред на находку через gh/glab
- `dex-skill-output-hygiene` - текст без LLM-маркеров для людей и ревью
- `dex-skill-karpathy-guidelines` - дисциплина изменений по мотивам Karpathy (MIT)
- `dex-skill-merge-conflict-resolution` - конфликты merge/rebase без тихой потери стороны (ours/theirs в rebase, modify/delete как переезд, lock-файлы, evil merge)

### Skills, переиспользуемые из маркетплейса
- `dex-skill-review-step-by-step` - пошаговый разбор замечаний через апрув
- `dex-skill-owasp-security` - OWASP Top 10
- `dex-skill-solid` - нарушения SOLID
- `dex-skill-testability` - тестируемость, скрытые зависимости, детерминизм
- `dex-skill-clean-architecture` - слои, зависимости, транзакции
- `dex-skill-git-workflow` - gitflow, conventional commits, code review
- `dex-skill-codebase-conventions` - конвенции и словарь проекта
- `dex-skill-ddd` - aggregate, value object, bounded context
- `dex-skill-issue-tracking` - синхрон трекера задач с ходом работы: право двигать статус, решётка «взял/готово/влито», агрегат зонтика

## Замечания

- Агенты языко-агностичны: стек определяется по манифестам проекта, релевантные skills (включая .NET и TypeScript) грузятся условно по содержимому diff. Стек-специфичные skills не входят в bundle намеренно: они ставятся со стек-бандлом (например `dex-bundle-dotnet-developer`) и подхватываются по необходимости. Кодер под `/implement` - тоже стек-специфичный агент (`dex-dotnet-coder`/`dex-ts-fullstack-coder`), не входит в этот bundle: без парного стек-бандла реализация фичи недоступна, доступны только ревью/план/саморевью/конфликты.
- Доставка ревью требует `gh` (GitHub) или `glab` (GitLab) с правом писать комментарии. Без прав агенты останавливаются на этапе плана тредов и не публикуют ничего.
