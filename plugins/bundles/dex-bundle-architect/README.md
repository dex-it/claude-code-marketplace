# Bundle: dex-bundle-architect

Bundle for Software Architects: architecture design, ADR, diagrams, API design, security, observability, system design.

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

## Included Components

Полный состав - `bundle.json`: `includes[]` (профиль роли) плюс `dependencies[]` (подтянутое замыканием); ниже - ключевые компоненты роли, не весь перечень.

### Команды
- `/design` - дизайн-решение и ADR
- `/discover` - обзорное ревью существующего кода

### Specialists
- `dex-architect` - System design and architecture
- `dex-adr-writer` - Architecture Decision Records (MADR)
- `dex-diagram-creator` - C4, sequence, ER, state diagrams
- `dex-api-designer` - REST/GraphQL/gRPC API design

### Skills
- `dex-skill-ddd` - Domain-Driven Design
- `dex-skill-dotnet-api-development` - API development
- `dex-skill-api-documentation` - API documentation
- `dex-skill-observability` - OpenTelemetry, metrics, tracing
- `dex-skill-doc-standards` - Documentation standards
- `dex-skill-adr-quality` - ADR oracle: norm vs code state, checkable norm, open-question default, edit vs new ADR
- `dex-skill-nfr` - NFR: источник числа меры, доступность, классификация данных
- `dex-skill-scalability` - Hot partition / hot key under long-tail load

## Note

This bundle is a convenience wrapper. Each component plugin works independently.
