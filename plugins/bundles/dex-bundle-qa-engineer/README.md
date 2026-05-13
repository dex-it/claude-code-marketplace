# Bundle: dex-bundle-qa-engineer

Bundle for QA Engineers: test analysis, test automation, bug reporting.

## Installation

```bash
# Linux / macOS / WSL
./install-bundle/install-bundle.sh qa-engineer

# Windows (PowerShell)
.\install-bundle\install-bundle.ps1 qa-engineer

# Preview what will be installed
./install-bundle/install-bundle.sh qa-engineer --dry-run
```

## Uninstallation

```bash
# Linux / macOS / WSL
./install-bundle/uninstall-bundle.sh qa-engineer

# Windows (PowerShell)
.\install-bundle\uninstall-bundle.ps1 qa-engineer
```

## Included Components (8)

### Specialists (3)
- `dex-test-analyst` - Test design and analysis
- `dex-test-automator` - Test automation
- `dex-bug-reporter` - Bug reporting

### Utilities (1)
- `dex-playwright-cli` - Playwright CLI: run tests, show report, codegen, trace viewer, browser install

### Skills (4)
- `dex-skill-test-design` - Test design techniques
- `dex-skill-api-testing` - API testing
- `dex-skill-dotnet-testing-patterns` - Testing patterns
- `dex-skill-playwright` - Playwright E2E traps: locators, auto-waiting, isolation, traces

## Note

This bundle is a convenience wrapper. Each component plugin works independently.
