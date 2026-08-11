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

## Included Components (26)

### Specialists (8)
- `dex-business-analyst` - Business requirements
- `dex-requirements-analyst` - System-level requirements from business ones
- `dex-requirements-orchestrator` - Requirements pipeline conductor (`/feature`)
- `dex-use-case-writer` - Use cases from feature requirements (pipeline phase 3b)
- `dex-user-story-writer` - User stories with acceptance criteria
- `dex-roadmap-planner` - Roadmap planning
- `dex-backlog-manager` - Backlog management
- `dex-pm-metrics-analyst` - Metrics analysis

### Skills (18)
- `dex-skill-agile` - Agile methodology
- `dex-skill-product-discovery` - Product discovery
- `dex-skill-epic-planning` - Epic planning
- `dex-skill-prioritization` - Prioritization frameworks
- `dex-skill-doc-standards` - Documentation standards
- `dex-skill-user-stories` - User story traps
- `dex-skill-business-analysis-29148` - Business analysis stage normative (BRD composition)
- `dex-skill-system-requirements-29148` - System requirements stage normative (SRS composition, FR/NFR attributes)
- `dex-skill-requirement-quality` - Requirement defect detection
- `dex-skill-requirement-set-quality` - Requirement set defect detection
- `dex-skill-nfr` - Non-functional requirement traps
- `dex-skill-node-contract` - Agent node handoff contract
- `dex-skill-project-docs-map` - Where project docs live
- `dex-skill-legacy-reconstruction` - Oracle reconstruction from legacy code without requirements
- `dex-skill-docs-layout` - Corpus layout: docs/ tree, mandatory minimum, identifiers
- `dex-skill-opportunity-canvas` - Idea genre normative (one-pager, opportunity canvas)
- `dex-skill-use-cases-cockburn` - Use case genre normative (sketch and normative formats)
- `dex-skill-use-case-quality` - Use case defect detection

## Note

This bundle is a convenience wrapper. Each component plugin works independently.
