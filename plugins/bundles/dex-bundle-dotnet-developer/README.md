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

## Included Components (12)

### Specialists (6)
- `dex-dotnet-coder` - .NET coding assistant
- `dex-dotnet-debugger` - Bug hunting and debugging
- `dex-dotnet-reviewer` - Code review specialist
- `dex-dotnet-tester` - Unit testing with xUnit/Moq
- `dex-ef-specialist` - Entity Framework Core specialist
- `dex-dotnet-performance` - Performance analysis

### Skills (6)
- `dex-skill-dotnet-patterns` - SOLID, DI, async/await patterns
- `dex-skill-ef-core` - EF Core best practices
- `dex-skill-async-patterns` - Async/await patterns
- `dex-skill-linq-optimization` - LINQ optimization
- `dex-skill-api-development` - REST API development
- `dex-skill-testing-patterns` - Testing patterns

## Note

This bundle is a convenience wrapper. Each component plugin works independently.
