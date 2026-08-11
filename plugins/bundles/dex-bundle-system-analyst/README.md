# Bundle: dex-bundle-system-analyst

Bundle for System Analysts: requirements, user stories, BPMN, API specs, documentation.

## Installation

```bash
# Linux / macOS / WSL
./install-bundle/install-bundle.sh system-analyst

# Windows (PowerShell)
.\install-bundle\install-bundle.ps1 system-analyst

# Preview what will be installed
./install-bundle/install-bundle.sh system-analyst --dry-run
```

## Uninstallation

```bash
# Linux / macOS / WSL
./install-bundle/uninstall-bundle.sh system-analyst

# Windows (PowerShell)
.\install-bundle\uninstall-bundle.ps1 system-analyst
```

## Included Components (14)

### Specialists (4)
- `dex-requirements-analyst` - Requirements analysis
- `dex-user-story-writer` - User story writing
- `dex-process-modeler` - BPMN process modeling
- `dex-doc-writer` - Technical documentation

### Skills (10)
- `dex-skill-agile` - Agile methodology
- `dex-skill-user-stories` - User story patterns
- `dex-skill-bpmn` - BPMN notation
- `dex-skill-api-specification` - API specification
- `dex-skill-doc-standards` - Documentation standards
- `dex-skill-system-requirements-29148` - System requirements stage normative (SRS composition, FR/NFR attributes)
- `dex-skill-architecture-definition-42010` - Architecture stage normative (concerns/views, arc42 sections)
- `dex-skill-use-cases-cockburn` - Use case genre normative (goal levels, extensions, guarantees)
- `dex-skill-docs-layout` - Corpus layout: docs/ tree, mandatory minimum, identifiers
- `dex-skill-use-case-quality` - Use case oracle

## Note

This bundle is a convenience wrapper. Each component plugin works independently.
