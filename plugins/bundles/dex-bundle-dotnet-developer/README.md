# Bundle: dex-bundle-dotnet-developer

Meta-plugin that combines multiple specialists into one role-based package.

## Automatic Installation

```bash
# Linux / macOS / WSL
./install-bundle/install-bundle.sh dotnet-developer

# Windows (PowerShell)
.\install-bundle\install-bundle.ps1 dotnet-developer

# Preview what will be installed
./install-bundle/install-bundle.sh dotnet-developer --dry-run
```

## Included Plugins

- `dex-dotnet-coder`
- `dex-dotnet-debugger`
- `dex-dotnet-reviewer`
- `dex-dotnet-tester`
- `dex-ef-specialist`
- `dex-dotnet-performance`
- `dex-skill-dotnet-patterns`
- `dex-skill-ef-core`
- `dex-skill-async-patterns`
- `dex-skill-linq-optimization`
- `dex-skill-api-development`
- `dex-skill-testing-patterns`

## Installation

Since Claude Code doesn't have native bundle dependency management, install each component separately:

```bash
# Install all components
claude plugins install dex-dotnet-coder
claude plugins install dex-dotnet-debugger
claude plugins install dex-dotnet-reviewer
claude plugins install dex-dotnet-tester
claude plugins install dex-ef-specialist
claude plugins install dex-dotnet-performance
claude plugins install dex-skill-dotnet-patterns
claude plugins install dex-skill-ef-core
claude plugins install dex-skill-async-patterns
claude plugins install dex-skill-linq-optimization
claude plugins install dex-skill-api-development
claude plugins install dex-skill-testing-patterns
```

## Note

This bundle is a convenience wrapper. Each component plugin works independently.
