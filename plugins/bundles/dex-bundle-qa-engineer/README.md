# Bundle: dex-bundle-qa-engineer

Meta-plugin that combines multiple specialists into one role-based package.

## Included Plugins

- `dex-test-analyst`
- `dex-test-automator`
- `dex-bug-reporter`
- `dex-skill-test-design`
- `dex-skill-api-testing`
- `dex-skill-testing-patterns`

## Installation

Since Claude Code doesn't have native bundle dependency management, install each component separately:

```bash
# Install all components
claude plugins install dex-test-analyst
claude plugins install dex-test-automator
claude plugins install dex-bug-reporter
claude plugins install dex-skill-test-design
claude plugins install dex-skill-api-testing
claude plugins install dex-skill-testing-patterns
```

## Note

This bundle is a convenience wrapper. Each component plugin works independently.
