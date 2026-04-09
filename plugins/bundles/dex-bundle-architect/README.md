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

## Included Components (15)

### Specialists (4)
- `dex-architect` - System design and architecture
- `dex-adr-writer` - Architecture Decision Records (MADR)
- `dex-diagram-creator` - C4, sequence, ER, state diagrams
- `dex-api-designer` - REST/GraphQL/gRPC API design

### Skills (11)
- `dex-skill-clean-architecture` - Clean Architecture patterns
- `dex-skill-ddd` - Domain-Driven Design
- `dex-skill-microservices` - Microservices patterns
- `dex-skill-dotnet-api-development` - API development
- `dex-skill-api-documentation` - API documentation
- `dex-skill-api-specification` - API specification & contracts
- `dex-skill-observability` - OpenTelemetry, metrics, tracing
- `dex-skill-owasp-security` - OWASP Top 10, security
- `dex-skill-doc-standards` - Documentation standards (BRD, PRD, ADR)
- `dex-skill-git-workflow` - Git workflow, conventional commits
- `dex-skill-system-design` - System design, NFR, capacity planning, CAP theorem

## Note

This bundle is a convenience wrapper. Each component plugin works independently.
