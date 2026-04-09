# Bundle Updater for Claude Code Marketplace
# Reinstalls (uninstall + install) all installed dex-plugins
# Requires: PowerShell 5.1+, claude CLI

param(
    [Alias("n")]
    [switch]$DryRun,

    [Alias("v")]
    [switch]$Verbose,

    [Alias("h")]
    [switch]$Help
)

# Output functions
function Write-Error-Colored { param($Message) Write-Host $Message -ForegroundColor Red }
function Write-Success { param($Message) Write-Host $Message -ForegroundColor Green }
function Write-Warning-Colored { param($Message) Write-Host $Message -ForegroundColor Yellow }
function Write-Info { param($Message) Write-Host $Message -ForegroundColor Cyan }
function Write-Header { param($Message) Write-Host $Message -ForegroundColor Magenta }
function Write-Dim { param($Message) Write-Host $Message -ForegroundColor DarkGray }

# Show help
function Show-Help {
    Write-Host ""
    Write-Header "======================================"
    Write-Header "  Update All Installed Plugins"
    Write-Header "======================================"
    Write-Host ""
    Write-Host "Usage: .\update-bundle.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "Reinstalls all installed dex-* plugins (uninstall + install)."
    Write-Host "Use this after pulling new versions from the marketplace repository."
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -DryRun, -n     Show what would be updated without changes"
    Write-Host "  -Verbose, -v    Show detailed output"
    Write-Host "  -Help, -h       Show this help message"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\update-bundle.ps1               # Update all installed dex-plugins"
    Write-Host "  .\update-bundle.ps1 -DryRun       # Preview what would be updated"
    Write-Host ""
}

# Get installed dex-plugins as objects with id property
function Get-InstalledDexPlugins {
    try {
        $output = & claude plugins list --json 2>$null
        if ($LASTEXITCODE -eq 0 -and $output) {
            $plugins = $output | ConvertFrom-Json
            return $plugins | Where-Object { $_.id -like "dex-*" }
        }
    } catch {
        # Returns empty
    }
    return @()
}

# Update all installed dex-plugins
function Update-All {
    Write-Host ""
    Write-Header "======================================"
    Write-Header "  Updating All Installed Plugins"
    Write-Header "======================================"
    Write-Host ""

    # Get installed dex-plugins
    $plugins = @(Get-InstalledDexPlugins)

    if ($plugins.Count -eq 0) {
        Write-Warning-Colored "  No dex-* plugins installed. Nothing to update."
        Write-Host ""
        return $true
    }

    $total = $plugins.Count
    Write-Info "  Plugins to update: $total"
    Write-Host ""

    if ($DryRun) {
        Write-Warning-Colored "  [DRY RUN] No actual changes will be made"
        Write-Host ""
    }

    # Counters
    $updated = 0
    $errors = 0
    $componentNum = 0

    foreach ($plugin in $plugins) {
        $componentNum++
        $pluginRef = $plugin.id
        $pluginName = ($pluginRef -split "@")[0]

        if ($DryRun) {
            Write-Info "  [$componentNum/$total] Would update: $pluginName"
            if ($Verbose) {
                Write-Dim "           Ref: $pluginRef"
            }
            $updated++
            continue
        }

        Write-Info "  [$componentNum/$total] Updating: $pluginName"
        if ($Verbose) {
            Write-Dim "           Ref: $pluginRef"
        }

        # Phase 1: Uninstall
        if ($Verbose) {
            Write-Dim "           Removing..."
        }
        try {
            $output = & claude plugins uninstall $pluginName 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-Error-Colored "           Failed to uninstall: $output"
                $errors++
                continue
            }
        } catch {
            Write-Error-Colored "           Failed to uninstall: $_"
            $errors++
            continue
        }

        # Phase 2: Install
        if ($Verbose) {
            Write-Dim "           Installing..."
        }
        try {
            $output = & claude plugins install $pluginRef 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Success "           Updated successfully"
                $updated++
            } else {
                Write-Error-Colored "           Failed to install: $output"
                $errors++
            }
        } catch {
            Write-Error-Colored "           Failed to install: $_"
            $errors++
        }
    }

    # Summary
    Write-Host ""
    Write-Header "======================================"
    Write-Header "  Summary"
    Write-Header "======================================"
    Write-Host ""

    if ($DryRun) {
        Write-Info "  Would update:  $updated"
    } else {
        Write-Success "  Updated:  $updated"
    }

    if ($errors -gt 0) {
        Write-Error-Colored "  Errors:   $errors"
    }

    Write-Host ""

    if ($DryRun) {
        Write-Host "Run without -DryRun to actually update."
        Write-Host ""
    }

    return ($errors -eq 0)
}

# Check dependencies
function Test-Dependencies {
    $claudeCmd = Get-Command claude -ErrorAction SilentlyContinue
    if (-not $claudeCmd) {
        Write-Error-Colored "Error: claude CLI is required but not installed."
        Write-Info "Install Claude Code: https://claude.ai/code"
        exit 1
    }
}

# Main logic
if ($Help) {
    Show-Help
    exit 0
}

Test-Dependencies
$result = Update-All
if ($result) {
    exit 0
} else {
    exit 1
}
