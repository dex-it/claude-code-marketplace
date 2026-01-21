# Bundle Installer for Claude Code Marketplace
# Automatically installs all components from a bundle's _bundle.includes[]
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
        if (Test-Path $pluginJson) {
            $bundleName = $bundle.Name -replace "^dex-bundle-", ""
            $config = Get-Content $pluginJson -Raw | ConvertFrom-Json
            $description = if ($config.description) { $config.description } else { "No description" }
            $includesCount = if ($config._bundle -and $config._bundle.includes) { $config._bundle.includes.Count } else { 0 }

            Write-Info "  $bundleName"
            Write-Dim "    $description"
            Write-Dim "    Components: $includesCount"
            Write-Host ""
        }
    }

    Write-Host "Usage: .\install-bundle.ps1 <bundle-name>"
    Write-Host ""
}

# Get source path for a plugin from marketplace.json
function Get-PluginSource {
    param([string]$PluginName)

    $marketplace = Get-Content $MarketplaceJson -Raw | ConvertFrom-Json
    $plugin = $marketplace.plugins | Where-Object { $_.name -eq $PluginName }
    if ($plugin) {
        return $plugin.source
    }
    return $null
}

# Install a single component
function Install-Component {
    param(
        [string]$ComponentName,
        [string]$SourcePath,
        [int]$ComponentNum,
        [int]$Total
    )

    if ($DryRun) {
        Write-Info "  [$ComponentNum/$Total] Would install: $ComponentName"
        if ($Verbose) {
            Write-Dim "           Source: $SourcePath"
        }
        return $true
    }

    Write-Info "  [$ComponentNum/$Total] Installing: $ComponentName"
    if ($Verbose) {
        Write-Dim "           Source: $SourcePath"
    }

    # Run claude plugins install
    try {
        $output = & claude plugins install $SourcePath 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "           Installed successfully"
            return $true
        } else {
            Write-Warning-Colored "           Already installed or skipped"
            return $false
        }
    } catch {
        Write-Warning-Colored "           Already installed or skipped"
        return $false
    }
}

# Install bundle
function Install-Bundle {
    param([string]$Name)

    $bundleDir = Join-Path $BundlesDir "dex-bundle-$Name"
    $pluginJson = Join-Path $bundleDir ".claude-plugin\plugin.json"

    # Check if bundle exists
    if (-not (Test-Path $bundleDir)) {
        Write-Error-Colored "Bundle not found: $Name"
        Write-Host ""
        Write-Host "Available bundles:"
        Get-BundlesShort
        Write-Host ""
        return
    }

    if (-not (Test-Path $pluginJson)) {
        Write-Error-Colored "plugin.json not found in bundle: $Name"
        return
    }

    # Check marketplace.json exists
    if (-not (Test-Path $MarketplaceJson)) {
        Write-Error-Colored "marketplace.json not found: $MarketplaceJson"
        return
    }

    # Get bundle info
    $config = Get-Content $pluginJson -Raw | ConvertFrom-Json
    $description = if ($config.description) { $config.description } else { "No description" }
    $includes = if ($config._bundle -and $config._bundle.includes) { $config._bundle.includes } else { @() }
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

    # Counters
    $installed = 0
    $skipped = 0
    $errors = 0
    $componentNum = 0

    # Process each component
    foreach ($component in $includes) {
        $componentNum++

        # Get source path from marketplace.json
        $source = Get-PluginSource -PluginName $component

        if (-not $source) {
            Write-Error-Colored "  [$componentNum/$total] Source not found for: $component"
            $errors++
            continue
        }

        # Convert relative path to absolute
        $fullSource = Join-Path $ProjectRoot ($source -replace "^\./", "")

        if (Install-Component -ComponentName $component -SourcePath $fullSource -ComponentNum $componentNum -Total $total) {
            $installed++
        } else {
            $skipped++
        }
    }

    # Summary
    Write-Host ""
    Write-Header "======================================"
    Write-Header "  Summary"
    Write-Header "======================================"
    Write-Host ""

    if ($DryRun) {
        Write-Info "  Would install: $installed components"
    } else {
        Write-Success "  Installed: $installed"
        Write-Warning-Colored "  Skipped:   $skipped"
    }

    if ($errors -gt 0) {
        Write-Error-Colored "  Errors:    $errors"
    }

    Write-Host ""

    if ($DryRun) {
        Write-Host "Run without -DryRun to actually install."
        Write-Host ""
    }
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
Install-Bundle -Name $BundleName
