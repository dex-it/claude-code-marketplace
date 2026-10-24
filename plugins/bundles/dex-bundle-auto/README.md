# Bundle: dex-bundle-auto

Агентская разработка в проекте на dex-auto: вход проекта, подготовка цели, автономные треки и фиксация истины. Бандл ставит `dex-auto` и скиллы, которые вызывают его узлы и команды: без них трек отрабатывает, но узел без своего скилла возвращает `blocked` либо `partial`.

## Installation

```bash
# Linux / macOS / WSL
./install-bundle/install-bundle.sh auto

# Windows (PowerShell)
.\install-bundle\install-bundle.ps1 auto

# Preview what will be installed
./install-bundle/install-bundle.sh auto --dry-run
```

Первые шаги после установки - раздел «Быстрый старт» README плагина `dex-auto`.

## Uninstallation

```bash
# Linux / macOS / WSL
./install-bundle/uninstall-bundle.sh auto

# Windows (PowerShell)
.\install-bundle\uninstall-bundle.ps1 auto
```

## Included Components

Полный состав - `bundle.json`: `includes[]` (профиль) плюс `dependencies[]` (подтянутое замыканием).

### Команды
- `/dex-auto:onboard` - вход проекта: скелет пустого проекта, корпус документации, BRD продукта и ADR решений устройства со статусом `review`, в `CLAUDE.md` порядок работы, гейты, карта, правила и запреты, перечень готовности репозитория
- `/dex-auto:goal` - цель из тикета, спеки или симптома
- `/dex-auto:auto` - прогон трека по цели, возобновление, сдача в PR/MR (`--pr`)

### Skills
- `dex-skill-project-docs-map`, `dex-skill-docs-layout` - корпус документации проекта и его раскладка
- `dex-skill-legacy-reconstruction` - реконструкция уровня 0 по коду
- `dex-skill-project-baseline` - гейты проекта: сборка, тесты, линт; закладка скелета пустого проекта
- `dex-skill-ci-gates`, `dex-skill-github-actions`, `dex-skill-gitlab-ci` - CI скелета пустого проекта
- `dex-skill-requirement-quality` - оракул требований цели
- `dex-skill-stack-registry` - стек проекта по манифесту
- `dex-skill-business-analysis-29148`, `dex-skill-adr-quality`, `dex-skill-functional-requirements`, `dex-skill-nfr`, `dex-skill-user-stories`, `dex-skill-use-cases-cockburn`, `dex-skill-bdd-gherkin` - нормы письма единиц корпуса (BR, ADR, FR, NFR, AC, UC): по ним узлы входа и фиксации пишут единицу своего вида

### Специалисты
- `dex-rulebook-miner` - свод правил проекта из истории ревью MR (`/dex-rulebook-miner:rulebook`): `/onboard` предлагает его, когда свода нет

## Note

This bundle is a convenience wrapper. Each component plugin works independently.
