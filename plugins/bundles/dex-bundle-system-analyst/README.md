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

## Included Components

Полный состав - `bundle.json` (`includes[]`); ниже - ключевые компоненты роли, не весь перечень.

### Команды
- `/design` - дизайн-решение и ADR
- `/feature` - требования фичи (BR -> UC -> FR/NFR -> stories)
- `/feature-check` - ревью готового набора требований

### Specialists
- `dex-requirements-analyst` - Requirements analysis
- `dex-user-story-analyst` - User story writing
- `dex-process-modeler` - BPMN process modeling
- `dex-doc-writer` - Technical documentation

### Skills
- `dex-skill-agile` - Agile methodology
- `dex-skill-user-stories` - User story patterns
- `dex-skill-bpmn` - BPMN notation
- `dex-skill-api-specification` - API specification
- `dex-skill-doc-standards` - Documentation standards

## Note

This bundle is a convenience wrapper. Each component plugin works independently.
