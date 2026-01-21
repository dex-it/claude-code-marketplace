# Bundle Installer

Automated installation scripts for Claude Code Marketplace bundles.

## Overview

Bundles are meta-plugins that group related specialists and skills together. Instead of manually running 10-30 `claude plugins install` commands, use these scripts to install all bundle components automatically.

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

## Usage

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

## Available Bundles

| Bundle | Description | Components |
|--------|-------------|------------|
| `dotnet-developer` | .NET Developer bundle | 12 |
| `dotnet-fullstack` | .NET Fullstack bundle | 29 |
| `devops` | DevOps Engineer bundle | 12 |
| `product-manager` | Product Manager bundle | 8 |
| `system-analyst` | System Analyst bundle | 12 |
| `architect` | Software Architect bundle | 8 |
| `qa-engineer` | QA Engineer bundle | 6 |
| `ml-engineer` | ML Engineer bundle | 11 |
| `infrastructure` | Infrastructure bundle | 24 |

## Command Line Options

### Bash

| Option | Short | Description |
|--------|-------|-------------|
| `--list` | `-l` | List all available bundles |
| `--dry-run` | `-n` | Preview without installing |
| `--verbose` | `-v` | Show detailed output |
| `--help` | `-h` | Show help message |

### PowerShell

| Option | Alias | Description |
|--------|-------|-------------|
| `-List` | `-l` | List all available bundles |
| `-DryRun` | `-n` | Preview without installing |
| `-Verbose` | `-v` | Show detailed output |
| `-Help` | `-h` | Show help message |

## How It Works

1. Reads the bundle's `plugin.json` from `plugins/bundles/dex-bundle-<name>/`
2. Extracts the `_bundle.includes[]` array (list of component plugin names)
3. For each component, looks up its `source` path in `marketplace.json`
4. Runs `claude plugins install <source>` for each component

## Example Output

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

  Installed: 10
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
chmod +x install-bundle.sh
```

### Component not found in marketplace.json

The component name in the bundle's `_bundle.includes[]` must match a plugin `name` in `marketplace.json`. Check for typos.

## Files

```
install-bundle/
├── install-bundle.sh    # Bash script (Linux/macOS/WSL)
├── install-bundle.ps1   # PowerShell script (Windows)
└── README.md            # This file
```
