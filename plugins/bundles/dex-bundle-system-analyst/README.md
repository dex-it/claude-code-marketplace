# Bundle: dex-bundle-system-analyst

Meta-plugin that combines multiple specialists into one role-based package.

## Included Plugins

- `dex-requirements-analyst`
- `dex-user-story-writer`
- `dex-process-modeler`
- `dex-doc-writer`
- `dex-skill-agile`
- `dex-skill-user-stories`
- `dex-skill-bpmn`
- `dex-skill-api-specification`
- `dex-skill-doc-standards`

## Installation

Since Claude Code doesn't have native bundle dependency management, install each component separately:

```bash
# Install all components
claude plugins install dex-requirements-analyst
claude plugins install dex-user-story-writer
claude plugins install dex-process-modeler
claude plugins install dex-doc-writer
claude plugins install dex-skill-agile
claude plugins install dex-skill-user-stories
claude plugins install dex-skill-bpmn
claude plugins install dex-skill-api-specification
claude plugins install dex-skill-doc-standards
```

## Note

This bundle is a convenience wrapper. Each component plugin works independently.
