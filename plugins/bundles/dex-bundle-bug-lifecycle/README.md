# dex-bundle-bug-lifecycle

Набор для полного цикла работы с багом: найти -> оформить -> расследовать корневую причину -> исправить на источнике. Языко-агностично.

## Цикл

- Поиск: `dex-bug-finder` (`/find-bugs`, плагин `dex-sdlc-test`) активно ищет дефекты, воспроизводит, отдаёт в handoff
- Оформление: `dex-bug-reporter` оформляет баг и handoff-карточку для расследования
- Расследование: `dex-incident-investigator` (`/investigate`, плагин `dex-sdlc-ops`) ведёт RCA на общем стенде до доказанной корневой причины
- Фикс: `/implement` (плагин `dex-sdlc-delivery`) через `dex-sdlc` и `dex-skill-development-track` (баг-фикс - под-вид, `dex-skill-bugfix-track`) применяет крупные многофайловые фиксы по плану

## Состав

Движок: `dex-sdlc`, `dex-skill-development-track`, `dex-skill-bugfix-track`.

Специалисты: `dex-bug-finder`, `dex-bug-reporter`, `dex-incident-investigator`.

Skills методологии: `dex-skill-problem-specification`, `dex-skill-root-cause-analysis`, `dex-skill-change-correlation`, `dex-skill-shared-stand-safety`, `dex-skill-exploratory-testing`, `dex-skill-bug-reproduction`, `dex-skill-contract-drift`.

Переиспользуемые skills: `dex-skill-owasp-security`, `dex-skill-testability`, `dex-skill-test-design`, `dex-skill-observability`, `dex-skill-codebase-conventions`, `dex-skill-no-loose-ends`.

CLI для чтения стенда: `dex-kubectl-cli`, `dex-gitlab-cli`, `dex-github-cli`, `dex-teamcity-cli`, `dex-jira-cli`.

## Замечания

Кодер под `/implement` (Phase 7 `development-track`, баг-фикс - под-вид `bugfix-track`) - стек-специфичный агент (`dex-dotnet-coder`/`dex-ts-fullstack-coder`), не входит в этот bundle: без парного стек-бандла (например `dex-bundle-dotnet-developer`) фикс через `/implement` недоступен, доступны поиск/оформление/расследование и `dex-bug-fixer` для пачки уже найденных багов.

## Установка

```bash
./install-bundle/install-bundle.sh bug-lifecycle
```

Предпросмотр без установки: `./install-bundle/install-bundle.sh bug-lifecycle --dry-run`.
