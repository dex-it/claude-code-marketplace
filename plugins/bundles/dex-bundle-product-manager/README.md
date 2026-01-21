# Bundle: dex-bundle-product-manager

Meta-plugin that combines multiple specialists into one role-based package.

## Included Plugins

- `dex-business-analyst`
- `dex-roadmap-planner`
- `dex-backlog-manager`
- `dex-pm-metrics-analyst`
- `dex-skill-agile`
- `dex-skill-product-discovery`
- `dex-skill-epic-planning`
- `dex-skill-prioritization`
- `dex-skill-doc-standards`

## Installation

Since Claude Code doesn't have native bundle dependency management, install each component separately:

```bash
# Install all components
claude plugins install dex-business-analyst
claude plugins install dex-roadmap-planner
claude plugins install dex-backlog-manager
claude plugins install dex-pm-metrics-analyst
claude plugins install dex-skill-agile
claude plugins install dex-skill-product-discovery
claude plugins install dex-skill-epic-planning
claude plugins install dex-skill-prioritization
claude plugins install dex-skill-doc-standards
```

## Note

This bundle is a convenience wrapper. Each component plugin works independently.
