# dex-bundle-bug-lifecycle

Набор для полного цикла работы с багом: найти -> оформить -> расследовать корневую причину -> исправить на источнике. Языко-агностично.

## Цикл

- Поиск: `dex-bug-finder` (`/find-bugs`) активно ищет дефекты, воспроизводит, отдаёт в handoff
- Оформление: `dex-bug-reporter` оформляет баг и handoff-карточку для расследования
- Расследование: `dex-incident-investigator` (`/investigate`) ведёт RCA на общем стенде до доказанной корневой причины
- Фикс: `dex-feature-implementer` (`/implement`) применяет крупные многофайловые фиксы по плану

## Состав

Специалисты: `dex-bug-finder`, `dex-bug-reporter`, `dex-incident-investigator`, `dex-feature-implementer`.

Skills методологии: `dex-skill-problem-specification`, `dex-skill-root-cause-analysis`, `dex-skill-change-correlation`, `dex-skill-shared-stand-safety`, `dex-skill-exploratory-testing`, `dex-skill-bug-reproduction`, `dex-skill-contract-drift`.

Переиспользуемые skills: `dex-skill-owasp-security`, `dex-skill-testability`, `dex-skill-test-design`, `dex-skill-observability`, `dex-skill-codebase-conventions`, `dex-skill-no-loose-ends`.

CLI для чтения стенда: `dex-kubectl-cli`, `dex-gitlab-cli`, `dex-teamcity-cli`.

## Установка

```bash
./install-bundle/install-bundle.sh bug-lifecycle
```

Предпросмотр без установки: `./install-bundle/install-bundle.sh bug-lifecycle --dry-run`.
