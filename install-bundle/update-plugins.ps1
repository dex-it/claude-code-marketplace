# Plugin Updater for Claude Code Marketplace
# Updates all installed dex-* plugins to the latest version
# Uses `claude plugin update` (atomic, safe, official CLI command).
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
    Write-Header "  Update All Installed dex-Plugins"
    Write-Header "======================================"
    Write-Host ""
    Write-Host "Usage: .\update-plugins.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "Updates all installed dex-* plugins (bundles, specialists, skills,"
    Write-Host "utilities) to the latest version using ``claude plugin update``."
    Write-Host ""
    Write-Host "Restart Claude Code after running this script to apply updates."
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -DryRun, -n     Show what would be updated without changes"
    Write-Host "  -Verbose, -v    Show detailed output"
    Write-Host "  -Help, -h       Show this help message"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\update-plugins.ps1               # Update all installed dex-plugins"
    Write-Host "  .\update-plugins.ps1 -DryRun       # Preview what would be updated"
    Write-Host ""
}

# Get installed dex-plugin objects.
# NOTE: `claude plugins list --json` and the `.id` field are undocumented CLI
# internals -- official docs (code.claude.com) only document install, uninstall,
# enable, disable, update, validate. If the command or schema changes, this
# function returns empty and the script reports "no plugins" instead of crashing.
function Get-InstalledDexPlugins {
    try {
        $output = & claude plugins list --json 2>$null
        if ($LASTEXITCODE -eq 0 -and $output) {
            $plugins = $output | ConvertFrom-Json
            return $plugins | Where-Object { $_.id -like "dex-*" }
        }
    } catch {
        # Graceful fallback -- return empty
    }
    return @()
}

# Update all installed dex-plugins
function Update-All {
    Write-Host ""
    Write-Header "======================================"
    Write-Header "  Updating All Installed dex-Plugins"
    Write-Header "======================================"
    Write-Host ""

    $plugins = @(Get-InstalledDexPlugins)

    if ($plugins.Count -eq 0) {
        Write-Warning-Colored "  No dex-* plugins installed. Nothing to update."
        Write-Host ""
        return $true
    }

    $total = $plugins.Count
    Write-Info "  Plugins to check: $total"
    Write-Host ""

    if ($DryRun) {
        Write-Warning-Colored "  [DRY RUN] No actual changes will be made"
        Write-Host ""
    }

    # Counters
    $updated = 0
    $already = 0
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

        Write-Info "  [$componentNum/$total] Checking: $pluginName"
        if ($Verbose) {
            Write-Dim "           Ref: $pluginRef"
        }

        # `claude plugin update` is atomic -- on failure the plugin stays at its
        # current version, no risk of ending up in a half-installed state.
        try {
            $output = & claude plugin update $pluginRef 2>&1
            if ($LASTEXITCODE -eq 0) {
                if ($output -match "already at the latest") {
                    Write-Warning-Colored "           Already at latest version"
                    $already++
                } else {
                    Write-Success "           Updated successfully"
                    $updated++
                }
            } else {
                Write-Error-Colored "           Failed: $output"
                $errors++
            }
        } catch {
            Write-Error-Colored "           Failed: $_"
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
        Write-Info "  Would check:  $updated"
    } else {
        Write-Success "  Updated:         $updated"
        Write-Warning-Colored "  Already latest:  $already"
    }

    if ($errors -gt 0) {
        Write-Error-Colored "  Errors:          $errors"
    }

    Write-Host ""

    if ($DryRun) {
        Write-Host "Run without -DryRun to actually update."
        Write-Host ""
    } elseif ($updated -gt 0) {
        Write-Warning-Colored "  Restart Claude Code to apply updates."
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
