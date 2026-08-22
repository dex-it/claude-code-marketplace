# Bundle: dex-bundle-dotnet-developer

Bundle for .NET developers: coding, debugging, testing, code review, EF Core, performance.

## Installation

```bash
# Linux / macOS / WSL
./install-bundle/install-bundle.sh dotnet-developer

# Windows (PowerShell)
.\install-bundle\install-bundle.ps1 dotnet-developer

# Preview what will be installed
./install-bundle/install-bundle.sh dotnet-developer --dry-run
```

## Uninstallation

```bash
# Linux / macOS / WSL
./install-bundle/uninstall-bundle.sh dotnet-developer

# Windows (PowerShell)
.\install-bundle\uninstall-bundle.ps1 dotnet-developer
```

## Included Components

Полный состав - `bundle.json` (`includes[]`); ниже - ключевые компоненты роли, не весь перечень.

### Команды
- `/design` - дизайн-решение и ADR
- `/discover` - обзорное ревью существующего кода
- `/find-bugs` - активный поиск багов в фиче
- `/implement` - реализация фичи до локальных коммитов
- `/investigate` - расследование инцидента на стенде
- `/mr-review` - первичное ревью чужого MR/PR
- `/review-plan` - план правок по замечаниям ревью
- `/root-cause` - поиск первопричины бага по коду
- `/test` - тесты на изменённый код

### Specialists
- `dex-dotnet-coder` - .NET coding assistant
- `dex-dotnet-tester` - Unit testing with xUnit/Moq
- `dex-ef-specialist` - Entity Framework Core specialist
- `dex-dotnet-performance` - Performance analysis
- `dex-debugger` - языко-агностичный root-cause (грузит .NET-skills по стеку)
- `dex-self-reviewer` - саморевью своей ветки перед push
- `dex-mr-reviewer` - ревью чужого MR

### Skills
- `dex-skill-dotnet-patterns` - SOLID, DI, async/await patterns
- `dex-skill-dotnet-ef-core` - EF Core best practices
- `dex-skill-dotnet-async-patterns` - Async/await patterns
- `dex-skill-dotnet-linq-optimization` - LINQ optimization
- `dex-skill-dotnet-api-development` - REST API development
- `dex-skill-dotnet-testing-patterns` - Testing patterns

## Note

This bundle is a convenience wrapper. Each component plugin works independently.
