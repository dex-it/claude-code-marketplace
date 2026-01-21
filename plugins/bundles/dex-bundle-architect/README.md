# Bundle: dex-bundle-architect

Bundle for Software Architects: architecture design, ADR, diagrams, API design.

## Installation

```bash
# Linux / macOS / WSL
./install-bundle/install-bundle.sh architect

# Windows (PowerShell)
.\install-bundle\install-bundle.ps1 architect

# Preview what will be installed
./install-bundle/install-bundle.sh architect --dry-run
```

## Uninstallation

```bash
# Linux / macOS / WSL
./install-bundle/uninstall-bundle.sh architect

# Windows (PowerShell)
.\install-bundle\uninstall-bundle.ps1 architect
```

## Included Components (9)

### Specialists (4)
- `dex-architect` - System design and architecture
- `dex-adr-writer` - Architecture Decision Records
- `dex-diagram-creator` - C4, sequence, Mermaid diagrams
- `dex-api-designer` - REST API design

### Skills (5)
- `dex-skill-clean-architecture` - Clean Architecture patterns
- `dex-skill-ddd` - Domain-Driven Design
- `dex-skill-microservices` - Microservices patterns
- `dex-skill-api-development` - API development
- `dex-skill-api-documentation` - API documentation

## Note

This bundle is a convenience wrapper. Each component plugin works independently.
