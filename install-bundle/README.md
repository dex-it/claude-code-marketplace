# Bundle Installer / Uninstaller / Updater

Automated installation, uninstallation, and update scripts for Claude Code Marketplace bundles.

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

## Update (reinstall all)

Since Claude Code CLI has no `plugins update` command, updating means uninstall + install. The update script does this automatically for **all installed dex-plugins** (bundles, specialists, skills, utilities).

### Bash (Linux / macOS / WSL)

```bash
# Update all installed dex-plugins
./update-bundle.sh

# Preview update (dry run)
./update-bundle.sh --dry-run

# Verbose output
./update-bundle.sh --verbose
```

### PowerShell (Windows)

```powershell
# Update all installed dex-plugins
.\update-bundle.ps1

# Preview update (dry run)
.\update-bundle.ps1 -DryRun
```

## Available Bundles

| Bundle | Description | Components |
|--------|-------------|------------|
| `dotnet-developer` | .NET Developer bundle | 12 |
| `dotnet-fullstack` | .NET Fullstack bundle | 29 |
| `devops` | DevOps Engineer bundle | 11 |
| `product-manager` | Product Manager bundle | 9 |
| `system-analyst` | System Analyst bundle | 9 |
| `architect` | Software Architect bundle | 9 |
| `qa-engineer` | QA Engineer bundle | 6 |
| `ml-engineer` | ML Engineer bundle | 11 |
| `infrastructure` | Infrastructure bundle | 23 |

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
2. Extracts the `includes[]` array (list of component plugin names)
3. Verifies each component is declared in `marketplace.json`
4. Resolves the marketplace name from `marketplace.json`
5. Runs `claude plugins install <component>@<marketplace>` for each component

### Uninstallation

1. Reads `bundle.json` from `plugins/bundles/dex-bundle-<name>/`
2. Extracts the `includes[]` array (list of component plugin names)
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
  [2/12] Installing: dex-dotnet-debugger
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
  [2/12] Uninstalling: dex-dotnet-debugger
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

The component name in `bundle.json` `includes[]` must match a plugin `name` in `marketplace.json`. Check for typos.

## Files

```
install-bundle/
├── install-bundle.sh      # Bash install script (Linux/macOS/WSL)
├── install-bundle.ps1     # PowerShell install script (Windows)
├── uninstall-bundle.sh    # Bash uninstall script (Linux/macOS/WSL)
├── uninstall-bundle.ps1   # PowerShell uninstall script (Windows)
├── update-bundle.sh       # Bash update script (Linux/macOS/WSL)
├── update-bundle.ps1      # PowerShell update script (Windows)
└── README.md              # This file
```
