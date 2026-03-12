# Bundle Uninstaller for Claude Code Marketplace
# Uninstalls all components listed in bundle.json
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
    Write-Header "  Bundle Uninstaller for Claude Code"
    Write-Header "======================================"
    Write-Host ""
    Write-Host "Usage: .\uninstall-bundle.ps1 [OPTIONS] [BUNDLE_NAME]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -List, -l       List all available bundles"
    Write-Host "  -DryRun, -n     Show what would be uninstalled without uninstalling"
    Write-Host "  -Verbose, -v    Show detailed output"
    Write-Host "  -Help, -h       Show this help message"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\uninstall-bundle.ps1 -List                    # Show all bundles"
    Write-Host "  .\uninstall-bundle.ps1 dotnet-developer          # Uninstall .NET Developer bundle"
    Write-Host "  .\uninstall-bundle.ps1 dotnet-developer -DryRun  # Preview uninstallation"
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

    Write-Host "Usage: .\uninstall-bundle.ps1 <bundle-name>"
    Write-Host ""
}

# Uninstall a single component
function Uninstall-Component {
    param(
        [string]$ComponentName,
        [int]$ComponentNum,
        [int]$Total
    )

    if ($DryRun) {
        Write-Info "  [$ComponentNum/$Total] Would uninstall: $ComponentName"
        return $true
    }

    Write-Info "  [$ComponentNum/$Total] Uninstalling: $ComponentName"

    # Run claude plugins uninstall
    try {
        $output = & claude plugins uninstall $ComponentName 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "           Removed successfully"
            return $true
        } else {
            $outputStr = $output -join " "
            if ($outputStr -match "not installed|not found") {
                Write-Warning-Colored "           Not installed (skipped)"
            } else {
                Write-Error-Colored "           Error: $outputStr"
            }
            return $false
        }
    } catch {
        Write-Warning-Colored "           Not installed (skipped)"
        return $false
    }
}

# Uninstall bundle
function Uninstall-Bundle {
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
        return $false
    }

    if (-not (Test-Path $bundleJsonPath)) {
        Write-Error-Colored "bundle.json not found in bundle: $Name"
        return $false
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
    Write-Header "  Uninstalling Bundle: $Name"
    Write-Header "======================================"
    Write-Host ""
    Write-Dim "  $description"
    Write-Host ""
    Write-Info "  Components to uninstall: $total"
    Write-Host ""

    if ($DryRun) {
        Write-Warning-Colored "  [DRY RUN] No actual uninstallation will be performed"
        Write-Host ""
    }

    # Counters
    $removed = 0
    $skipped = 0
    $errors = 0
    $componentNum = 0

    # Process each component
    foreach ($component in $includes) {
        $componentNum++

        if (Uninstall-Component -ComponentName $component -ComponentNum $componentNum -Total $total) {
            $removed++
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
        Write-Info "  Would uninstall: $removed components"
    } else {
        Write-Success "  Removed:  $removed"
        Write-Warning-Colored "  Skipped:  $skipped"
    }

    if ($errors -gt 0) {
        Write-Error-Colored "  Errors:   $errors"
    }

    Write-Host ""

    if ($DryRun) {
        Write-Host "Run without -DryRun to actually uninstall."
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
$result = Uninstall-Bundle -Name $BundleName
if ($result) {
    exit 0
} else {
    exit 1
}
