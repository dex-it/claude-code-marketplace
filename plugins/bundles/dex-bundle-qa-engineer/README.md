# Bundle: dex-bundle-qa-engineer

Bundle for QA Engineers: test analysis, test automation, bug reporting.

## Installation

```bash
# Linux / macOS / WSL
./install-bundle/install-bundle.sh qa-engineer

# Windows (PowerShell)
.\install-bundle\install-bundle.ps1 qa-engineer

# Preview what will be installed
./install-bundle/install-bundle.sh qa-engineer --dry-run
```

## Uninstallation

```bash
# Linux / macOS / WSL
./install-bundle/uninstall-bundle.sh qa-engineer

# Windows (PowerShell)
.\install-bundle\uninstall-bundle.ps1 qa-engineer
```

## Included Components

Полный состав - `bundle.json`: `includes[]` (профиль роли) плюс `dependencies[]` (подтянутое замыканием); ниже - ключевые компоненты роли, не весь перечень.

### Команды
- `/find-bugs` - активный поиск багов в фиче
- `/review-stand` - приёмка слитой фичи на стенде
- `/test` - тесты на изменённый код
- `/bdd` - карта примеров и сборка `.feature` из `AC` истории

### Specialists
- `dex-test-analyst` - Test design and analysis
- `dex-test-automator` - Test automation
- `dex-bug-reporter` - Bug reporting
- `dex-bdd-author` - карта примеров и `.feature` как производная форма `AC`

### Utilities
- `dex-playwright-cli` - Playwright CLI: run tests, show report, codegen, trace viewer, browser install

### Skills
- `dex-skill-test-design` - Test design techniques
- `dex-skill-api-testing` - API testing
- `dex-skill-dotnet-testing-patterns` - Testing patterns
- `dex-skill-playwright` - Playwright E2E traps: locators, auto-waiting, isolation, traces
- `dex-skill-bdd-gherkin` - Gherkin и Example Mapping: граница «пример против теста»

## Note

This bundle is a convenience wrapper. Each component plugin works independently.
