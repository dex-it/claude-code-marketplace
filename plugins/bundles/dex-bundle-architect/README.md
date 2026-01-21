# Bundle: dex-bundle-architect

Meta-plugin that combines multiple specialists into one role-based package.

## Included Plugins

- `dex-architect`
- `dex-adr-writer`
- `dex-diagram-creator`
- `dex-api-designer`
- `dex-skill-clean-architecture`
- `dex-skill-ddd`
- `dex-skill-microservices`
- `dex-skill-api-development`
- `dex-skill-api-documentation`

## Installation

Since Claude Code doesn't have native bundle dependency management, install each component separately:

```bash
# Install all components
claude plugins install dex-architect
claude plugins install dex-adr-writer
claude plugins install dex-diagram-creator
claude plugins install dex-api-designer
claude plugins install dex-skill-clean-architecture
claude plugins install dex-skill-ddd
claude plugins install dex-skill-microservices
claude plugins install dex-skill-api-development
claude plugins install dex-skill-api-documentation
```

## Note

This bundle is a convenience wrapper. Each component plugin works independently.
