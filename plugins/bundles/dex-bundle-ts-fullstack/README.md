# Bundle: dex-bundle-ts-fullstack

Bundle для TypeScript fullstack: разработка Node/React, тесты, ревью, обзор существующего кода.

## Installation

```bash
# Linux / macOS / WSL
./install-bundle/install-bundle.sh ts-fullstack

# Windows (PowerShell)
.\install-bundle\install-bundle.ps1 ts-fullstack

# Preview what will be installed
./install-bundle/install-bundle.sh ts-fullstack --dry-run
```

## Uninstallation

```bash
# Linux / macOS / WSL
./install-bundle/uninstall-bundle.sh ts-fullstack

# Windows (PowerShell)
.\install-bundle\uninstall-bundle.ps1 ts-fullstack
```

## Included Components

Полный состав - `bundle.json`: `includes[]` (профиль роли) плюс `dependencies[]` (подтянутое замыканием); ниже - ключевые компоненты роли, не весь перечень.

### Команды
- `/discover` - обзорное ревью существующего кода
- `/implement` - реализация фичи до локальных коммитов
- `/test` - тесты на изменённый код
- `/find-bugs` - активный поиск багов в фиче
- `/mr-review` - ревью входящего MR/PR и ре-ревью дельты
- `/review-plan` - разбор пришедшего ревью: план правок, ответы в треды

### Specialists
- `dex-ts-fullstack-coder` - TypeScript fullstack разработка
- `dex-ts-tester` - unit-тесты на Vitest/Jest
- `dex-bug-finder` - активный поиск багов в фиче
- `dex-code-discovery` - обзорное ревью существующего кода
- `dex-security-reviewer` - модель угроз и attack-path
- `dex-adr-writer` - фиксация архитектурных решений в ADR
- `dex-mr-reviewer` / `dex-mr-check-reviewer` - первичное ревью MR/PR и ре-ревью дельты
- `dex-review-planner` - план правок по пришедшему ревью
- `dex-skill-merge-conflict-resolution` - подтягивание базовой ветки и разбор конфликтов (`/resolve-conflicts`)

### Skills
- `dex-skill-ts-patterns` - идиомы TypeScript
- `dex-skill-ts-nodejs-api` - Node.js API
- `dex-skill-ts-vitest-jest` - тестирование на Vitest/Jest
- `dex-skill-react` - React

## Note

This bundle is a convenience wrapper. Each component plugin works independently.
