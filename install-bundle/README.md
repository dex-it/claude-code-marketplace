# Bundle Installer / Uninstaller

Automated installation and uninstallation scripts for Claude Code Marketplace bundles.

## Overview

Bundles are meta-plugins that group related specialists and skills together. Instead of manually running 10-30 `claude plugins install` commands, use these scripts to install or uninstall all bundle components automatically.

## Requirements

### Linux / macOS / WSL

- `jq` - JSON processor
- `claude` CLI

```bash
# Install jq
# Ubuntu/Debian
sudo apt install jq

# macOS
brew install jq

# Arch
sudo pacman -S jq
```

### Windows

- PowerShell 5.1+ (pre-installed)
- `claude` CLI

## Installation

### Bash (Linux / macOS / WSL)

```bash
# List available bundles
./install-bundle.sh --list

# Install a bundle
./install-bundle.sh dotnet-developer

# Preview installation (dry run)
./install-bundle.sh dotnet-developer --dry-run

# Verbose output
./install-bundle.sh dotnet-developer --verbose
```

### PowerShell (Windows)

```powershell
# List available bundles
.\install-bundle.ps1 -List

# Install a bundle
.\install-bundle.ps1 dotnet-developer

# Preview installation (dry run)
.\install-bundle.ps1 dotnet-developer -DryRun

# Verbose output
.\install-bundle.ps1 dotnet-developer -Verbose
```

## Uninstallation

### Bash (Linux / macOS / WSL)

```bash
# List available bundles
./uninstall-bundle.sh --list

# Uninstall a bundle
./uninstall-bundle.sh dotnet-developer

# Preview uninstallation (dry run)
./uninstall-bundle.sh dotnet-developer --dry-run
```

### PowerShell (Windows)

```powershell
# List available bundles
.\uninstall-bundle.ps1 -List

# Uninstall a bundle
.\uninstall-bundle.ps1 dotnet-developer

# Preview uninstallation (dry run)
.\uninstall-bundle.ps1 dotnet-developer -DryRun
```

## Sync (protect installed agents from skill degradation)

Installation is flat - there is no specialist->skill cascade. An agent loads skills imperatively via the Skill tool (`dex-skill-X:Y`); if such a skill is not installed it does not resolve and the agent silently degrades. Over time this drifts: an agent gets a new skill reference upstream, or you installed an agent without all the skills it loads.

`sync-plugins.sh` anchors on **what you have installed** (not on bundles): for every installed agent it reads the skills that agent loads from the repo's agent files (`plugins/specialists/**/agents/*.md`, the source of truth) and reports/installs the non-by-stack skills that are missing.

```bash
# Report drift only (which installed agent loads which missing skill)
./sync-plugins.sh

# Install the missing skills
./sync-plugins.sh --fix

# Per-agent detail
./sync-plugins.sh --verbose
```

Windows (PowerShell 5.1+, no `jq` needed) has the same script with the same report: `.\sync-plugins.ps1`, `.\sync-plugins.ps1 -Fix`, `.\sync-plugins.ps1 -Verbose`. Keep the two in step - `tests/tools/sync-plugins.test.sh` runs one set of scenarios against both.

It **never installs new agents** - "something new appeared in the market" is a manual decision. It also lists installed plugins that the catalogue no longer declares (removed or renamed upstream) with their uninstall command, and never removes them itself - see [Renamed and removed plugins](#renamed-and-removed-plugins-manual-step). It does **not** touch versions (updating is a separate manual op via the marketplace). by-stack profile skills (`dex-skill-{dotnet,ts,python,...}-*`) are exempt - they are loaded conditionally per project stack. Run from a clone of the marketplace repo.

## Renamed and removed plugins (manual step)

Neither `install-bundle.sh` nor `sync-plugins.sh` removes anything: sync only adds missing skills, and the uninstaller walks the bundle's current component lists (`includes[]` + `dependencies[]`). A plugin dropped from the marketplace therefore stays installed and keeps being loaded by name - no error is raised, because the file is still on disk.

`./sync-plugins.sh` names such plugins: every installed plugin of this marketplace that `.claude-plugin/marketplace.json` of your clone no longer declares is listed with its uninstall command. It only reports - `--fix` never removes. Look the name up in the table below for the replacement; if your clone is behind the marketplace, `git pull` first, otherwise a plugin added after your last update is listed as well.

Uninstall such plugins by hand:

```bash
claude plugins uninstall <old-plugin-name>
```

`npm run validate` (`tools/validate-readme.js`) checks that no name in the first column is declared in `marketplace.json` now (`removed-plugin-live`) and that this section still has a table (`removed-table-unreadable`). Completeness - that every removed name has a row - is not checked: it needs git history, and CI may run on a shallow clone.

Current entries - every plugin name that was ever declared in `marketplace.json` and is not declared now (a name that never reached the catalogue could not be installed and is not listed). A plugin that was renamed and later removed has one row naming both names:

| Removed | Replacement | Notes |
|---|---|---|
| `dex-skill-dotnet-project-baseline` | `dex-skill-project-baseline` | stack-neutral successor, same skill name inside the plugin changed from `dotnet-project-baseline` to `project-baseline` |
| `dex-skill-agile` | - | removed by control runs: the model holds the subject without the skill |
| `dex-skill-bpmn` | - | removed by control runs: the model holds the subject without the skill |
| `dex-skill-karpathy-guidelines` | - | removed by control runs: the model holds the subject without the skill |
| `dex-skill-api-specification` | - | removed by control runs: the model holds the subject without the skill (protocol `tests/trap-skills/removed/api-specification/README.md`) |
| `dex-skill-cap-consistency` | - | removed by control runs: the model holds the subject without the skill (protocol `tests/trap-skills/removed/cap-consistency/README.md`) |
| `dex-skill-capacity-planning` | - | removed by control runs: the model holds the subject without the skill (protocol `tests/trap-skills/removed/capacity-planning/README.md`) |
| `dex-skill-clean-architecture` | - | removed by control runs: the model holds the subject without the skill (protocol `tests/trap-skills/removed/clean-architecture/README.md`) |
| `dex-skill-contract-drift` | - | removed by control runs: the model holds the subject without the skill (protocol `tests/trap-skills/removed/contract-drift/README.md`) |
| `dex-skill-deep-audit` | - | removed by control runs: the model holds the subject without the skill (protocol `tests/trap-skills/removed/deep-audit/README.md`) |
| `dex-skill-distributed-resilience` | - | removed by control runs: the model holds the subject without the skill (protocol `tests/trap-skills/removed/distributed-resilience/README.md`) |
| `dex-skill-docker` | - | removed by control runs: the model holds the subject without the skill (protocol `tests/trap-skills/removed/docker/README.md`) |
| `dex-skill-dotnet-caching` | - | removed by control runs: the model holds the subject without the skill (protocol `tests/trap-skills/removed/dotnet-caching/README.md`) |
| `dex-skill-dotnet-config-hygiene` | - | removed by control runs: the model holds the subject without the skill (protocol `tests/trap-skills/removed/dotnet-config-hygiene/README.md`) |
| `dex-skill-dotnet-di` | - | removed by control runs: the model holds the subject without the skill (protocol `tests/trap-skills/removed/dotnet-di/README.md`) |
| `dex-skill-linq-optimization`, `dex-skill-dotnet-linq-optimization` | - | removed by control runs: the model holds the subject without the skill (protocol `tests/trap-skills/removed/dotnet-linq-optimization/README.md`); installed before the rename (a53848df, 2026-04-09) as `dex-skill-linq-optimization` - same plugin, same fate |
| `dex-skill-dotnet-resources` | - | removed by control runs: the model holds the subject without the skill (protocol `tests/trap-skills/removed/dotnet-resources/README.md`) |
| `dex-skill-exploratory-testing` | - | removed by control runs: the model holds the subject without the skill (protocol `tests/trap-skills/removed/exploratory-testing/README.md`) |
| `dex-skill-git-workflow` | - | removed by control runs: the model holds the subject without the skill (protocol `tests/trap-skills/removed/git-workflow/README.md`) |
| `dex-skill-microservices` | - | removed by control runs: the model holds the subject without the skill (protocol `tests/trap-skills/removed/microservices/README.md`) |
| `dex-skill-no-loose-ends` | - | removed by control runs: the model holds the subject without the skill (protocol `tests/trap-skills/removed/no-loose-ends/README.md`) |
| `dex-skill-output-hygiene` | - | removed by control runs: the model holds the subject without the skill (protocol `tests/trap-skills/removed/output-hygiene/README.md`) |
| `dex-skill-owasp-security` | - | removed by control runs: the model holds the subject without the skill (protocol `tests/trap-skills/removed/owasp-security/README.md`) |
| `dex-skill-problem-specification` | - | removed by control runs: the model holds the subject without the skill (protocol `tests/trap-skills/removed/problem-specification/README.md`) |
| `dex-skill-classical-ml`, `dex-skill-python-classical-ml` | - | removed by control runs: the model holds the subject without the skill (protocol `tests/trap-skills/removed/python-classical-ml/README.md`); installed before the rename (ee3670e3, 2026-06-07) as `dex-skill-classical-ml` - same plugin, same fate |
| `dex-skill-reference-architectures` | - | removed by control runs: the model holds the subject without the skill (protocol `tests/trap-skills/removed/reference-architectures/README.md`) |
| `dex-skill-tech-audit` | - | removed: no consumers in the catalogue (protocol `tests/trap-skills/removed/tech-audit/README.md`) |
| `dex-skill-tech-evaluation` | - | removed by control runs: the model holds the subject without the skill (protocol `tests/trap-skills/removed/tech-evaluation/README.md`) |
| `dex-skill-test-design` | - | removed by control runs: the model holds the subject without the skill (protocol `tests/trap-skills/removed/test-design/README.md`) |
| `dex-skill-typescript-patterns`, `dex-skill-ts-patterns` | - | removed by control runs: the model holds the subject without the skill (protocol `tests/trap-skills/removed/ts-patterns/README.md`); installed before the rename (ee3670e3, 2026-06-07) as `dex-skill-typescript-patterns` - same plugin, same fate |
| `dex-skill-use-cases` | - | removed by control runs: the model holds the subject without the skill (protocol `tests/trap-skills/removed/use-cases/README.md`) |
| `dex-skill-api-development` | `dex-skill-dotnet-api-development` | renamed with the `dotnet-` prefix (`a53848df`, 2026-04-09) |
| `dex-skill-async-patterns` | `dex-skill-dotnet-async-patterns` | renamed with the `dotnet-` prefix (`a53848df`, 2026-04-09) |
| `dex-skill-ef-core` | `dex-skill-dotnet-ef-core` | renamed with the `dotnet-` prefix (`a53848df`, 2026-04-09) |
| `dex-skill-logging` | `dex-skill-dotnet-logging` | renamed with the `dotnet-` prefix (`a53848df`, 2026-04-09) |
| `dex-skill-testing-patterns` | `dex-skill-dotnet-testing-patterns` | renamed with the `dotnet-` prefix (`a53848df`, 2026-04-09) |
| `dex-skill-dotnet-patterns` | `dex-skill-solid`, `dex-skill-testability` | split into four narrow skills (`a53848df`, 2026-04-09); the other two, `dex-skill-dotnet-di` and `dex-skill-dotnet-resources`, are removed above |
| `dex-skill-computer-vision` | `dex-skill-python-computer-vision` | renamed with the stack prefix (`ee3670e3`, 2026-06-07) |
| `dex-skill-ml-optimization` | `dex-skill-python-ml-optimization` | renamed with the stack prefix (`ee3670e3`, 2026-06-07) |
| `dex-skill-nlp-transformers` | `dex-skill-python-nlp-transformers` | renamed with the stack prefix (`ee3670e3`, 2026-06-07) |
| `dex-skill-pytorch` | `dex-skill-python-pytorch` | renamed with the stack prefix (`ee3670e3`, 2026-06-07) |
| `dex-skill-tensorflow` | `dex-skill-python-tensorflow` | renamed with the stack prefix (`ee3670e3`, 2026-06-07) |
| `dex-skill-nodejs-api` | `dex-skill-ts-nodejs-api` | renamed with the stack prefix (`ee3670e3`, 2026-06-07) |
| `dex-skill-vitest-jest` | `dex-skill-ts-vitest-jest` | renamed with the stack prefix (`ee3670e3`, 2026-06-07) |
| `dex-skill-system-design` | `dex-skill-nfr`, `dex-skill-scalability` | split into seven narrow skills (`82b6f0e6`, 2026-05-03); the other five (`dex-skill-capacity-planning`, `dex-skill-cap-consistency`, `dex-skill-tech-evaluation`, `dex-skill-reference-architectures`, `dex-skill-distributed-resilience`) are removed above |
| `dex-skill-adr-authoring` | `dex-skill-adr-quality` | renamed (`d97b3503`, 2026-07-21) |
| `dex-skill-business-analysis` | `dex-skill-business-analysis-29148` | renamed with the standard suffix (`148d10e8`, 2026-08-11) |
| `dex-skill-scenario-quality` | `dex-skill-bdd-gherkin` | the oracle was dropped with the `scenario` type; its traps live in the `bdd-gherkin` genre norm (`2499bef8`, 2026-08-11) |
| `dex-skill-review-breakdown` | - | dropped with writing the review breakdown to a file; typing a finding is done by `dex-skill-defect-classification` in the review agents (`8b2c0dc2`, 2026-09-15) |
| `dex-skill-project-rulebook`, `dex-skill-rule-mining`, `dex-skill-rulebook-quality` | `dex-rulebook-miner` | the three skills moved inside the miner plugin (`4b26d6f5`, 2026-09-16); install the plugin, not the skills |
| `dex-skill-orchestration-executor`, `dex-skill-orchestration-planner` | - | experimental pair taken out of the catalogue and kept as the subject of `tests/orchestration/` (`27399310`, 2026-10-13); the `/do` command went with the planner |
| `dex-dotnet-debugger` | `dex-debugger` | duplicate of the stack-neutral agent; .NET depth comes from by-stack skills |
| `dex-dotnet-reviewer` | `dex-self-reviewer`, `dex-mr-reviewer` | duplicate: own branch -> self-reviewer, someone else's PR/MR -> mr-reviewer |
| `dex-user-story-writer` | `dex-user-story-analyst` | renamed and rewritten as a node of the requirements pipeline (`7e8cf09d`, 2026-08-16) |
| `dex-dotnet-developer` | bundle `dotnet-developer` | monolithic v4 plugin split into atomic plugins (`0c89e799`, 2026-01-16); install the closest bundle instead |
| `dex-dotnet-architect` | bundle `architect` | monolithic v4 plugin split into atomic plugins (`0c89e799`, 2026-01-16); install the closest bundle instead |
| `dex-devops` | bundle `devops` | monolithic v4 plugin split into atomic plugins (`0c89e799`, 2026-01-16); install the closest bundle instead |
| `dex-product-manager` | bundle `product-manager` | monolithic v4 plugin split into atomic plugins (`0c89e799`, 2026-01-16); install the closest bundle instead |
| `dex-system-analyst` | bundle `system-analyst` | monolithic v4 plugin split into atomic plugins (`0c89e799`, 2026-01-16); install the closest bundle instead |
| `dex-quality-assurance` | bundle `qa-engineer` | monolithic v4 plugin split into atomic plugins (`0c89e799`, 2026-01-16); install the closest bundle instead |
| `dex-python-ml-developer` | bundle `ml-engineer` | monolithic v4 plugin split into atomic plugins (`0c89e799`, 2026-01-16); install the closest bundle instead |

### Catalogue 6.0.0: the SDLC engine is gone

`6.0.0` drops the engine, its zone-command plugins, its track skills and the earlier names of the same parts. The commands
survive under the same slash names inside the plugin of the specialist they delegate to, so **an
installed old plugin keeps shipping a same-named command whose body still calls the deleted engine**
(`dex-sdlc:engine`). Which of the two wins is not defined. Uninstall the old plugins **before**
re-running `install-bundle.sh`:

```bash
for p in dex-bundle-sdlc dex-sdlc dex-sdlc-acceptance dex-sdlc-delivery dex-sdlc-design \
         dex-sdlc-discover dex-sdlc-docs dex-sdlc-nudge dex-sdlc-ops dex-sdlc-product \
         dex-sdlc-requirements dex-sdlc-resume dex-sdlc-review dex-sdlc-test \
         dex-conflict-resolver dex-skill-acceptance-track dex-skill-analytics-track \
         dex-skill-architecture-track dex-skill-bugfix-track dex-skill-development-track \
         dex-skill-diagnostics-track dex-skill-discover-track dex-skill-documentation-track \
         dex-skill-followup-track dex-skill-mr-review-track dex-skill-product-track \
         dex-skill-test-track dex-skill-catalog-track dex-skill-zone-registry \
         dex-skill-autonomous-task dex-autonomous-task-resume dex-feature-implementer \
         dex-requirements-orchestrator; do
  claude plugins uninstall "$p"
done
```

`./uninstall-bundle.sh sdlc` no longer works: the uninstaller resolves the component list from
`plugins/bundles/dex-bundle-<name>/bundle.json` in this clone, and that directory is gone. The loop
above is the replacement for anyone who had the bundle installed.

The engine also left state behind. `auto-ledger/<TASK>.md` files under the Claude Code config
directory were written by the engine and read by the `dex-sdlc-resume` hook; with both removed
nothing reads or cleans them, and the directory can be deleted.

| Removed | Replacement | Notes |
|---|---|---|
| `dex-bundle-sdlc` | none | profile components redistributed across the role bundles; there is no single successor bundle |
| `dex-sdlc` | none | the engine itself (skill `engine`, `auto-ledger`, resume cycle) |
| `dex-sdlc-product` | `dex-business-analyst` | carries `/product` |
| `dex-sdlc-requirements` | `dex-business-analyst`, `dex-requirements-reviewer` | `/feature` and `/feature-check` respectively |
| `dex-sdlc-design` | `dex-architect` | carries `/design` |
| `dex-sdlc-discover` | `dex-code-discovery` | carries `/discover` |
| `dex-sdlc-delivery` | `dex-implement` | carries `/implement`; stack-agnostic, picks the coder from the repo manifest |
| `dex-sdlc-test` | `dex-bug-finder`, `dex-test` | `/find-bugs` and `/test` respectively |
| `dex-sdlc-review` | `dex-mr-reviewer`, `dex-review-planner` | `/mr-review` and `/review-plan` respectively |
| `dex-sdlc-acceptance` | `dex-stand-reviewer` | carries `/review-stand` |
| `dex-sdlc-ops` | `dex-incident-investigator`, `dex-debugger` | `/investigate` and `/root-cause` respectively |
| `dex-sdlc-docs` | `dex-doc-writer` | carries `/documentation` |
| `dex-sdlc-nudge` | none | hook that raised the engine on a work request; the entry point is now the slash command |
| `dex-sdlc-resume` | none | hook that reminded to resume after a context compaction |
| `dex-conflict-resolver` | `dex-skill-merge-conflict-resolution` | the node was dissolved into a skill protocol; `/resolve-conflicts` moved with it |
| `dex-skill-acceptance-track` | none | zone order absorbed by `/review-stand` |
| `dex-skill-analytics-track` | none | zone order absorbed by `/feature` |
| `dex-skill-architecture-track` | none | zone order absorbed by `/design` |
| `dex-skill-bugfix-track` | none | zone order absorbed by `/implement` |
| `dex-skill-development-track` | none | zone order absorbed by `/implement` |
| `dex-skill-diagnostics-track` | none | zone order absorbed by `/investigate` and `/root-cause` |
| `dex-skill-discover-track` | none | zone order absorbed by `/discover` |
| `dex-skill-documentation-track` | none | zone order absorbed by `/documentation` |
| `dex-skill-followup-track` | none | zone order absorbed by `/review-plan` |
| `dex-skill-mr-review-track` | none | zone order absorbed by `/mr-review` |
| `dex-skill-product-track` | none | zone order absorbed by `/product` |
| `dex-skill-test-track` | none | zone order absorbed by `/test` |
| `dex-skill-catalog-track` | none | zone of editing catalogue artefacts; the track went with the engine |
| `dex-skill-zone-registry` | none | maps a request to a zone and its track; went with the engine |
| `dex-skill-autonomous-task` | none | replaced by the engine `dex-sdlc` (`5ac6cfba`, 2026-08-29), which this release removes |
| `dex-autonomous-task-resume` | none | earlier name of the `dex-sdlc-resume` hook |
| `dex-feature-implementer` | `dex-implement` | earlier name of `dex-sdlc-delivery`; carried `/implement` |
| `dex-requirements-orchestrator` | `dex-business-analyst`, `dex-requirements-reviewer` | earlier name of `dex-sdlc-requirements`; carried `/feature` and `/feature-check` |

## Available Bundles

Component counts are not listed here: they change with every composition edit and a stale number
here reads as a promise. `./install-bundle.sh --list` prints the live count next to each bundle.

| Bundle | Description |
|--------|-------------|
| `architect` | Software Architect: system design, ADR, diagrams, API design, codebase analysis, security, observability |
| `auto` | Agentic development on dex-auto: project onboarding, goal, autonomous feature, bugfix and review tracks, truth fixation |
| `bug-lifecycle` | Bug lifecycle: active hunting, reporting, root-cause investigation on a shared stand, fix at the source |
| `cli-tools` | CLI wrappers for diagnostics (gh, glab, jira, kubectl, jenkins, teamcity, psql, redis-cli, kaf, rabbitmqadmin, aws-s3, playwright) |
| `code-review` | Code lifecycle, language-agnostic: MR/PR review, delta re-review, fix plan, feature implementation, conflict resolution, pre-push self-review, stand acceptance |
| `devops` | DevOps Engineer: Docker, Kubernetes, CI/CD, monitoring, logging |
| `dotnet-developer` | .NET Developer: coding, debugging, tests, code review, EF Core, performance, .NET architecture design |
| `dotnet-fullstack` | .NET Fullstack: development, databases, message brokers, containers, CI/CD, monitoring, architecture design |
| `infrastructure` | Infrastructure: databases, message brokers, containers, CI/CD, monitoring |
| `market-editor` | Catalogue norm authoring: normative unit form and edit budget, catalogue artefact review against framework axes, fact verification, LLM-oriented trimming, document corpus naming and identifiers, lessons mined from other teams' MRs. For the catalogue author, not its users |
| `ml-engineer` | ML Engineer: experiments, model training, debugging, deployment, data pipelines |
| `product-manager` | Product Manager: business requirements, roadmap, backlog, metrics analysis |
| `qa-engineer` | QA Engineer: test analysis, automation (incl. Playwright E2E), active bug hunting, bug reports |
| `runtime-diagnostics` | Runtime diagnostics for .NET and the native boundary: hang, crash, leak, dumps, netcoredbg |
| `system-analyst` | System Analyst: requirements, user stories, BPMN, API specs, documentation, feasibility |
| `ts-fullstack` | TypeScript Fullstack: Node.js/Bun backend and React frontend, security, Docker, Playwright E2E |

## Command Line Options

### Install (Bash)

| Option | Short | Description |
|--------|-------|-------------|
| `--list` | `-l` | List all available bundles |
| `--dry-run` | `-n` | Preview without installing |
| `--verbose` | `-v` | Show detailed output |
| `--help` | `-h` | Show help message |

### Uninstall (Bash)

| Option | Short | Description |
|--------|-------|-------------|
| `--list` | `-l` | List all available bundles |
| `--dry-run` | `-n` | Preview without uninstalling |
| `--verbose` | `-v` | Show detailed output |
| `--help` | `-h` | Show help message |

### Install (PowerShell)

| Option | Alias | Description |
|--------|-------|-------------|
| `-List` | `-l` | List all available bundles |
| `-DryRun` | `-n` | Preview without installing |
| `-Verbose` | `-v` | Show detailed output |
| `-Help` | `-h` | Show help message |

### Uninstall (PowerShell)

| Option | Alias | Description |
|--------|-------|-------------|
| `-List` | `-l` | List all available bundles |
| `-DryRun` | `-n` | Preview without uninstalling |
| `-Verbose` | `-v` | Show detailed output |
| `-Help` | `-h` | Show help message |

## How It Works

### Installation

1. Reads `bundle.json` from `plugins/bundles/dex-bundle-<name>/`
2. Extracts the component lists - `includes[]` (the role profile the bundle is built for) plus `dependencies[]` (what the profile pulls in transitively)
3. Verifies each component is declared in `marketplace.json`
4. Resolves the marketplace name from `marketplace.json`
5. Runs `claude plugins install <component>@<marketplace>` for each component

### Uninstallation

1. Reads `bundle.json` from `plugins/bundles/dex-bundle-<name>/`
2. Extracts the component lists - `includes[]` plus `dependencies[]`
3. Runs `claude plugins uninstall <component>` for each component

> **Note:** Component lists are stored in `bundle.json`, not `plugin.json`.
> Claude Code strictly validates `plugin.json` and silently breaks plugins with unknown fields.

## Re-running Scripts

The scripts are **idempotent** - you can run them multiple times safely:

- **Install**: Already installed components are reported as "Already installed"
- **Uninstall**: Components that are not installed are skipped

This makes it safe to re-run the script if it was interrupted or if you want to ensure all components are properly installed/removed.

## Example Output

### Installation

```
======================================
  Installing Bundle: dotnet-developer
======================================

  Bundle for .NET developers: coding, debugging, testing, code review, EF Core, performance.

  Components to install: 12

  [1/12] Installing: dex-dotnet-coder
           Installed successfully
  [2/12] Installing: dex-dotnet-tester
           Installed successfully
  ...

======================================
  Summary
======================================

  Installed:          10
  Already installed:  2
```

### Uninstallation

```
======================================
  Uninstalling Bundle: dotnet-developer
======================================

  Bundle for .NET developers: coding, debugging, testing, code review, EF Core, performance.

  Components to uninstall: 12

  [1/12] Uninstalling: dex-dotnet-coder
           Removed successfully
  [2/12] Uninstalling: dex-dotnet-tester
           Removed successfully
  ...

======================================
  Summary
======================================

  Removed:   10
  Skipped:   2
```

## Troubleshooting

### jq not found (Linux/macOS)

```bash
# Ubuntu/Debian
sudo apt install jq

# macOS
brew install jq
```

### claude not found

Ensure Claude Code CLI is installed and in your PATH:
- https://claude.ai/code

### Permission denied (Linux/macOS)

```bash
chmod +x install-bundle.sh uninstall-bundle.sh
```

### Component not found in marketplace.json

A component name in `bundle.json` (`includes[]` or `dependencies[]`) must match a plugin `name` in `marketplace.json`. Check for typos.

## Files

```
install-bundle/
├── install-bundle.sh         # Bash install script for plugin bundles (Linux/macOS/WSL)
├── install-bundle.ps1        # PowerShell install script for plugin bundles (Windows)
├── uninstall-bundle.sh       # Bash uninstall script (Linux/macOS/WSL)
├── uninstall-bundle.ps1      # PowerShell uninstall script (Windows)
├── install-cli-tools.sh      # Bash installer for underlying CLI binaries (gh, kubectl, psql, ...)
├── install-cli-tools.ps1     # PowerShell mirror for Windows
├── sync-plugins.sh           # Sync installed agents with the skills they load (anti-degradation)
├── sync-plugins.ps1          # PowerShell mirror for Windows
└── README.md                 # This file
```

## install-cli-tools (CLI binaries on the host)

Plugin bundles install **slash-command plugins** for Claude Code. The `dex-*-cli` plugins still need their underlying CLI binaries (`gh`, `glab`, `kubectl`, `psql`, `redis-cli`, `kaf`, `netcoredbg`, `gdb`, и т.д.) on your machine. Use `install-cli-tools` to set them up:

```bash
# Linux / macOS / WSL - auto-detects apt / dnf / pacman / apk / brew
./install-cli-tools.sh --check          # see what's installed and missing
./install-cli-tools.sh --all            # install everything missing
./install-cli-tools.sh psql redis-cli   # install specific tools
./install-cli-tools.sh --all --dry-run  # preview

# Update already-installed tools to latest
./install-cli-tools.sh --update gh kubectl     # update specific tools
./install-cli-tools.sh --update --all          # update everything installed
./install-cli-tools.sh --update --check        # show what would be updated

# Windows - uses winget / scoop / choco
.\install-cli-tools.ps1 -Check
.\install-cli-tools.ps1 -All
.\install-cli-tools.ps1 -Update gh kubectl
.\install-cli-tools.ps1 -Update -All
```

### Runtime-diagnostics meta-target

For the `runtime-diagnostics` bundle, install all underlying CLI binaries at once:

```bash
# Linux / macOS / WSL - installs netcoredbg, gdb, lldb, strace, bpftrace, bcc, perf,
# binutils, rizin, ilspycmd, flamegraph, valgrind, lief, dotnet-diagnostic-tools
./install-cli-tools.sh runtime-diagnostics-tools

# Windows - installs cross-platform ones (ilspycmd, lief, dotnet-diagnostic-tools);
# Linux-only utilities are reported as __UNSUPPORTED__ with WSL hint
.\install-cli-tools.ps1 runtime-diagnostics-tools
```

`--update` / `-u` (and `-Update` for PowerShell) skips the «Already installed» early-return and transforms install commands into upgrade commands per-PM. For Linux `apt` / `dnf` and curl-based recipes (kubectl, kaf, aws, ...) this is a no-op - they already upgrade on re-run. For `brew`, `apk`, `pacman`, `winget`, `scoop`, `choco` - `install` is replaced with the appropriate upgrade subcommand. On Arch, `pacman -S` becomes `pacman -Syu` (full system upgrade - partial upgrades are unsupported per ArchWiki, which means `--update` may upgrade more packages than the one you asked for). The summary distinguishes `Updated` (version changed) from `Already at latest` (recipe ran but version unchanged). See [`docs/CLI_UTILITIES.md`](../docs/CLI_UTILITIES.md) -> «Обновление установленных инструментов» for the full transformation table.

This is a separate concern from `install-bundle`: you might install the `cli-tools` bundle (the plugins) on a CI machine without ever touching the host binaries, or vice versa. See [`docs/CLI_UTILITIES.md`](../docs/CLI_UTILITIES.md) for the full install matrix and per-tool configuration notes.
