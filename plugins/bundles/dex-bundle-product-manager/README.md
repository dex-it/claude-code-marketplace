# Bundle: dex-bundle-product-manager

Bundle for Product Managers: business requirements, roadmap, backlog, metrics analysis.

## Installation

```bash
# Linux / macOS / WSL
./install-bundle/install-bundle.sh product-manager

# Windows (PowerShell)
.\install-bundle\install-bundle.ps1 product-manager

# Preview what will be installed
./install-bundle/install-bundle.sh product-manager --dry-run
```

## Uninstallation

```bash
# Linux / macOS / WSL
./install-bundle/uninstall-bundle.sh product-manager

# Windows (PowerShell)
.\install-bundle\uninstall-bundle.ps1 product-manager
```

## Included Components (17)

### Specialists (6)
- `dex-business-analyst` - Business requirements
- `dex-requirements-orchestrator` - Requirements pipeline conductor (`/feature`)
- `dex-user-story-writer` - User stories with acceptance criteria
- `dex-roadmap-planner` - Roadmap planning
- `dex-backlog-manager` - Backlog management
- `dex-pm-metrics-analyst` - Metrics analysis

### Skills (11)
- `dex-skill-agile` - Agile methodology
- `dex-skill-product-discovery` - Product discovery
- `dex-skill-epic-planning` - Epic planning
- `dex-skill-prioritization` - Prioritization frameworks
- `dex-skill-doc-standards` - Documentation standards
- `dex-skill-user-stories` - User story traps
- `dex-skill-requirement-quality` - Requirement defect detection
- `dex-skill-requirement-set-quality` - Requirement set defect detection
- `dex-skill-nfr` - Non-functional requirement traps
- `dex-skill-node-contract` - Agent node handoff contract
- `dex-skill-project-docs-map` - Where project docs live

## Note

This bundle is a convenience wrapper. Each component plugin works independently.
