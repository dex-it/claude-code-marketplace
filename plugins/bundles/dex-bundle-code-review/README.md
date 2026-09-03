# Bundle: dex-bundle-code-review

Bundle для полного цикла работы с кодом, языко-агностично: реализация фичи по ТЗ, интеграция базовой ветки с разрешением конфликтов merge/rebase, pre-push саморевью, ревью чужого MR/PR, итеративное ре-ревью дельты, план правок по ревью. Плюс skills дисциплины ревью и реализации.

Цикл замыкается так: `/implement` через `dex-sdlc` и `dex-skill-development-track` (реализация до локальных коммитов, баг-фикс - под-вид `dex-skill-bugfix-track`, делегирует root cause `dex-debugger`) -> `dex-conflict-resolver` (подтянуть базу и развести конфликты merge/rebase) -> `dex-self-reviewer` (саморевью перед push) -> push и открытие MR -> `dex-mr-reviewer` (ревью на стороне ревьюера) -> автор правит -> `dex-mr-check-reviewer` (ре-ревью дельты) и `dex-review-planner` (план правок на стороне автора).

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

### Движок
- `dex-sdlc` - движок (`dex-sdlc:engine`); командные входы живут в плагинах зон, ставятся отдельно
- `dex-sdlc-delivery` - вход `/implement` (зона реализации)
- `dex-sdlc-test` - входы `/test`, `/find-bugs` (зона тест-инжиниринга)
- `dex-sdlc-review` - входы `/mr-review`, `/review-plan` (зона ревью)
- `dex-sdlc-acceptance` - вход `/review-stand` (приёмка на стенде)
- `dex-sdlc-ops` - входы `/investigate`, `/root-cause` (диагностика)
- `dex-sdlc-rulebook` - вход `/rulebook` (зона свода правил проекта). Зоны требований, дизайна и документации в этот bundle не входят - их команды ставятся своими плагинами
- `dex-skill-development-track` - порядок работ зоны реализации (`/implement`), баг-фикс - под-вид
- `dex-skill-bugfix-track` - под-вид `/implement` для бага: red-тест до фикса, делегирует root cause `dex-debugger`
- `dex-skill-followup-track` - обработка внешнего ревью на уже сданном MR (переход из Development Track)
- `dex-skill-rulebook-track` - порядок работ зоны свода правил (`/rulebook`); трек судит свод, писать его - дело узла

### Specialists
- `dex-mr-reviewer` - первичное ревью чужого MR/PR, инлайн-треды через gh/glab (`/mr-review`, движок `dex-sdlc`)
- `dex-mr-check-reviewer` - итеративное ре-ревью дельты с прошлой ревизии (вторая ревизия `/mr-review`, не своя команда)
- `dex-review-planner` - план правок по ревью без редактирования кода (`/review-plan`, движок `dex-sdlc`)
- `dex-self-reviewer` - pre-push саморевью своей ветки с реальным прогоном тестов (`/self-review`)
- `dex-conflict-resolver` - подтянуть базу в фича-ветку и развести конфликты merge/rebase без тихой потери стороны (`/resolve-conflicts`)
- `dex-debugger` - root cause по коду, вызывается `bugfix-track` при баг-фиксе через `/implement`
- `dex-rulebook-miner` - добыча свода правил проекта из истории ревью: оркестратор пишет корпус, read-only сборщики разбирают источники (`/rulebook`, движок `dex-sdlc`)

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

## Замечания

- Агенты языко-агностичны: стек определяется по манифестам проекта, релевантные skills (включая .NET и TypeScript) грузятся условно по содержимому diff. Стек-специфичные skills не входят в bundle намеренно: они ставятся со стек-бандлом (например `dex-bundle-dotnet-developer`) и подхватываются по необходимости. Кодер под `/implement` (Phase 7 `development-track`) - тоже стек-специфичный агент (`dex-dotnet-coder`/`dex-ts-fullstack-coder`), не входит в этот bundle: без парного стек-бандла реализация фичи недоступна, доступны только ревью/план/саморевью/конфликты.
- Доставка ревью требует `gh` (GitHub) или `glab` (GitLab) с правом писать комментарии. Без прав агенты останавливаются на этапе плана тредов и не публикуют ничего.
