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

## Included Components (35)

### Engine (1)
- `dex-sdlc` - SDLC engine (`dex-sdlc:engine`) plus `/feature`, `/implement`, `/feature-check`; delegates zone order to `dex-skill-analytics-track`

### Specialists (9)
- `dex-business-analyst` - Business requirements (BRD)
- `dex-requirements-analyst` - System-level requirements (FR/NFR) from business ones
- `dex-usecase-analyst` - Use case scenarios from business requirements
- `dex-user-story-analyst` - User stories with acceptance criteria
- `dex-implementer-reader` - Readiness probe for a finished requirement set
- `dex-requirements-reviewer` - Requirement set review
- `dex-roadmap-planner` - Roadmap planning
- `dex-backlog-manager` - Backlog management
- `dex-pm-metrics-analyst` - Metrics analysis

### Skills (25)
- `dex-skill-project-docs-map` - Where project docs live
- `dex-skill-agile` - Agile methodology
- `dex-skill-product-discovery` - Product discovery
- `dex-skill-epic-planning` - Epic planning
- `dex-skill-prioritization` - Prioritization frameworks
- `dex-skill-doc-standards` - Documentation standards
- `dex-skill-requirement-quality` - Requirement defect detection (unit)
- `dex-skill-nfr` - Non-functional requirement traps
- `dex-skill-node-contract` - Agent node handoff contract
- `dex-skill-analytics-track` - Zone 1 requirements pipeline order (BRD -> use cases -> FR/NFR -> stories)
- `dex-skill-business-analysis` - Business analysis stage normative (BRD composition)
- `dex-skill-requirement-set-quality` - Requirement set defect detection
- `dex-skill-decision-log` - Requirements pipeline decision log
- `dex-skill-user-stories` - User story traps
- `dex-skill-legacy-reconstruction` - Oracle reconstruction from legacy code without requirements
- `dex-skill-use-cases` - Use case scenario traps
- `dex-skill-functional-requirements` - Functional requirement unit traps
- `dex-skill-unit-identity` - Requirement unit identity (same unit vs new, numbering)
- `dex-skill-artifact-naming` - Requirements artifact naming/layout convention
- `dex-skill-test-design` - Test design technique traps
- `dex-skill-codebase-conventions` - Project convention vs technical decision
- `dex-skill-ddd` - DDD traps
- `dex-skill-fact-verification` - Technical fact verification against source of truth
- `dex-skill-review-evidence` - Review evidence discipline and falsification
- `dex-skill-output-hygiene` - Output text hygiene without LLM markers

## Note

This bundle is a convenience wrapper. Each component plugin works independently.
