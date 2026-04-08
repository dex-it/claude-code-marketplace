# Bundle Installer for Claude Code Marketplace
# Installs all components listed in bundle.json
# Requires: PowerShell 5.1+, claude CLI

param(
    [Parameter(Position=0)]
    [string]$BundleName,

    [Alias("l")]
    [switch]$List,

    [Alias("n")]
    [switch]$DryRun,

    [Alias("v")]
    [switch]$Verbose,

    [Alias("h")]
    [switch]$Help
)

# Paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$BundlesDir = Join-Path $ProjectRoot "plugins\bundles"
$MarketplaceJson = Join-Path $ProjectRoot ".claude-plugin\marketplace.json"

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
    Write-Header "  Bundle Installer for Claude Code"
    Write-Header "======================================"
    Write-Host ""
    Write-Host "Usage: .\install-bundle.ps1 [OPTIONS] [BUNDLE_NAME]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -List, -l       List all available bundles"
    Write-Host "  -DryRun, -n     Show what would be installed without installing"
    Write-Host "  -Verbose, -v    Show detailed output"
    Write-Host "  -Help, -h       Show this help message"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\install-bundle.ps1 -List                    # Show all bundles"
    Write-Host "  .\install-bundle.ps1 dotnet-developer          # Install .NET Developer bundle"
    Write-Host "  .\install-bundle.ps1 dotnet-developer -DryRun  # Preview installation"
    Write-Host ""
    Write-Host "Available bundles:"
    Get-BundlesShort
    Write-Host ""
}

# List bundles (short format)
function Get-BundlesShort {
    if (-not (Test-Path $BundlesDir)) {
        Write-Error-Colored "  Bundles directory not found: $BundlesDir"
        return
    }

    $bundles = Get-ChildItem -Path $BundlesDir -Directory -Filter "dex-bundle-*"
    foreach ($bundle in $bundles) {
        $bundleName = $bundle.Name -replace "^dex-bundle-", ""
        Write-Host "  - $bundleName"
    }
}

# List bundles (detailed)
function Get-BundlesDetailed {
    Write-Host ""
    Write-Header "======================================"
    Write-Header "  Available Bundles"
    Write-Header "======================================"
    Write-Host ""

    if (-not (Test-Path $BundlesDir)) {
        Write-Error-Colored "Bundles directory not found: $BundlesDir"
        return
    }

    $bundles = Get-ChildItem -Path $BundlesDir -Directory -Filter "dex-bundle-*"
    foreach ($bundle in $bundles) {
        $pluginJson = Join-Path $bundle.FullName ".claude-plugin\plugin.json"
        $bundleJson = Join-Path $bundle.FullName "bundle.json"
        if ((Test-Path $pluginJson) -and (Test-Path $bundleJson)) {
            $bundleName = $bundle.Name -replace "^dex-bundle-", ""
            $config = Get-Content $pluginJson -Raw | ConvertFrom-Json
            $bundleConfig = Get-Content $bundleJson -Raw | ConvertFrom-Json
            $description = if ($config.description) { $config.description } else { "No description" }
            $includesCount = if ($bundleConfig.includes) { @($bundleConfig.includes).Count } else { 0 }

            Write-Info "  $bundleName"
            Write-Dim "    $description"
            Write-Dim "    Components: $includesCount"
            Write-Host ""
        }
    }

    Write-Host "Usage: .\install-bundle.ps1 <bundle-name>"
    Write-Host ""
}

# Check that a plugin is declared in marketplace.json
function Test-PluginInMarketplace {
    param([string]$PluginName)

    $marketplace = Get-Content $MarketplaceJson -Raw | ConvertFrom-Json
    $plugin = $marketplace.plugins | Where-Object { $_.name -eq $PluginName }
    return [bool]$plugin
}

# Get marketplace name from marketplace.json
function Get-MarketplaceName {
    $marketplace = Get-Content $MarketplaceJson -Raw | ConvertFrom-Json
    return $marketplace.name
}

# Fetch installed plugin ids (format: name@marketplace) as a HashSet.
# `claude plugins install` is idempotent and always reports success, so we pre-fetch
# the list once per bundle and check membership locally to produce honest stats.
# NOTE: `claude plugins list --json` and the `.id` field are undocumented CLI internals.
# Graceful fallback: if the command fails, returns empty set → all components proceed to install.
function Get-InstalledPluginIds {
    $ids = New-Object 'System.Collections.Generic.HashSet[string]'
    try {
        $output = & claude plugins list --json 2>$null
        if ($LASTEXITCODE -eq 0 -and $output) {
            $plugins = $output | ConvertFrom-Json
            foreach ($plugin in $plugins) {
                if ($plugin.id) { [void]$ids.Add($plugin.id) }
            }
        }
    } catch {
        # Swallow — returns empty set, install proceeds as fallback
    }
    return $ids
}

# Install a single component via `claude plugins install name@marketplace`.
# Returns: "Installed", "AlreadyInstalled", or "Error".
function Install-Component {
    param(
        [string]$ComponentName,
        [string]$MarketplaceName,
        [int]$ComponentNum,
        [int]$Total,
        [System.Collections.Generic.HashSet[string]]$InstalledIds
    )

    $pluginRef = "$ComponentName@$MarketplaceName"

    if ($InstalledIds -and $InstalledIds.Contains($pluginRef)) {
        Write-Warning-Colored "  [$ComponentNum/$Total] Already installed: $ComponentName"
        if ($Verbose) {
            Write-Dim "           Ref: $pluginRef"
        }
        return "AlreadyInstalled"
    }

    if ($DryRun) {
        Write-Info "  [$ComponentNum/$Total] Would install: $ComponentName"
        if ($Verbose) {
            Write-Dim "           Ref: $pluginRef"
        }
        return "Installed"
    }

    Write-Info "  [$ComponentNum/$Total] Installing: $ComponentName"
    if ($Verbose) {
        Write-Dim "           Ref: $pluginRef"
    }

    # Run claude plugins install
    try {
        $output = & claude plugins install $pluginRef 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "           Installed successfully"
            return "Installed"
        } else {
            Write-Error-Colored "           Failed: $output"
            return "Error"
        }
    } catch {
        Write-Error-Colored "           Failed: $_"
        return "Error"
    }
}

# Install bundle
function Install-Bundle {
    param([string]$Name)

    $bundleDir = Join-Path $BundlesDir "dex-bundle-$Name"
    $pluginJson = Join-Path $bundleDir ".claude-plugin\plugin.json"
    $bundleJsonPath = Join-Path $bundleDir "bundle.json"

    # Check if bundle exists
    if (-not (Test-Path $bundleDir)) {
        Write-Error-Colored "Bundle not found: $Name"
        Write-Host ""
        Write-Host "Available bundles:"
        Get-BundlesShort
        Write-Host ""
        return
    }

    if (-not (Test-Path $bundleJsonPath)) {
        Write-Error-Colored "bundle.json not found in bundle: $Name"
        return
    }

    # Check marketplace.json exists
    if (-not (Test-Path $MarketplaceJson)) {
        Write-Error-Colored "marketplace.json not found: $MarketplaceJson"
        return
    }

    # Get bundle info
    $description = "No description"
    if (Test-Path $pluginJson) {
        $config = Get-Content $pluginJson -Raw | ConvertFrom-Json
        if ($config.description) { $description = $config.description }
    }
    $bundleConfig = Get-Content $bundleJsonPath -Raw | ConvertFrom-Json
    $includes = if ($bundleConfig.includes) { @($bundleConfig.includes) } else { @() }
    $total = $includes.Count

    Write-Host ""
    Write-Header "======================================"
    Write-Header "  Installing Bundle: $Name"
    Write-Header "======================================"
    Write-Host ""
    Write-Dim "  $description"
    Write-Host ""
    Write-Info "  Components to install: $total"
    Write-Host ""

    if ($DryRun) {
        Write-Warning-Colored "  [DRY RUN] No actual installation will be performed"
        Write-Host ""
    }

    # Resolve marketplace name (used as @marketplace suffix for claude plugins install)
    $marketplaceName = Get-MarketplaceName
    if (-not $marketplaceName) {
        Write-Error-Colored "  Could not determine marketplace name from $MarketplaceJson"
        return $false
    }
    if ($Verbose) {
        Write-Dim "  Marketplace: $marketplaceName"
        Write-Host ""
    }

    # Pre-fetch installed plugin ids once — CLI install is idempotent and always reports
    # success, so we need our own check to produce honest "already installed" stats.
    $installedIds = Get-InstalledPluginIds

    # Counters
    $installed = 0
    $already = 0
    $errors = 0
    $componentNum = 0

    # Process each component
    foreach ($component in $includes) {
        $componentNum++

        # Verify plugin is declared in marketplace.json (sanity check)
        if (-not (Test-PluginInMarketplace -PluginName $component)) {
            Write-Error-Colored "  [$componentNum/$total] Not declared in marketplace.json: $component"
            $errors++
            continue
        }

        $result = Install-Component -ComponentName $component -MarketplaceName $marketplaceName -ComponentNum $componentNum -Total $total -InstalledIds $installedIds
        switch ($result) {
            "Installed"        { $installed++ }
            "AlreadyInstalled" { $already++ }
            default            { $errors++ }
        }
    }

    # Summary
    Write-Host ""
    Write-Header "======================================"
    Write-Header "  Summary"
    Write-Header "======================================"
    Write-Host ""

    if ($DryRun) {
        Write-Info "  Would install:      $installed components"
        Write-Warning-Colored "  Already installed:  $already"
    } else {
        Write-Success "  Installed:          $installed"
        Write-Warning-Colored "  Already installed:  $already"
    }

    if ($errors -gt 0) {
        Write-Error-Colored "  Errors:             $errors"
    }

    Write-Host ""

    if ($DryRun) {
        Write-Host "Run without -DryRun to actually install."
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

if ($List) {
    Test-Dependencies
    Get-BundlesDetailed
    exit 0
}

if (-not $BundleName) {
    Show-Help
    exit 0
}

Test-Dependencies
$result = Install-Bundle -Name $BundleName
if ($result) {
    exit 0
} else {
    exit 1
}
