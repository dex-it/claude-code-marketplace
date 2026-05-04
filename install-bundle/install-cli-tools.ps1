# CLI Tools Installer for Claude Code Marketplace (PowerShell)
# Installs underlying CLI binaries used by dex-*-cli plugins.
# Auto-detects package manager (winget / scoop / choco). Idempotent.
#
# Supported tools: gh, glab, kubectl, psql, redis-cli, kaf
# See docs/CLI_UTILITIES.md for the install matrix and per-tool notes.

param(
    [Parameter(Position=0, ValueFromRemainingArguments=$true)]
    [string[]]$Tools = @(),

    [Alias("l")]
    [switch]$List,

    [Alias("c")]
    [switch]$Check,

    [Alias("a")]
    [switch]$All,

    [Alias("n")]
    [switch]$DryRun,

    [Alias("v")]
    [switch]$VerboseOutput,

    [Alias("h")]
    [switch]$Help
)

$SupportedTools = @("gh", "glab", "kubectl", "psql", "redis-cli", "kaf", "rabbitmqadmin", "aws")

function Write-ErrC  { param($m) Write-Host $m -ForegroundColor Red }
function Write-Ok    { param($m) Write-Host $m -ForegroundColor Green }
function Write-Warn  { param($m) Write-Host $m -ForegroundColor Yellow }
function Write-Info  { param($m) Write-Host $m -ForegroundColor Cyan }
function Write-Hdr   { param($m) Write-Host $m -ForegroundColor Magenta }
function Write-Dim   { param($m) Write-Host $m -ForegroundColor DarkGray }

function Show-Help {
    Write-Host ""
    Write-Hdr "================================================"
    Write-Hdr "  CLI Tools Installer for Claude Code Marketplace"
    Write-Hdr "================================================"
    Write-Host ""
    Write-Host "Usage: .\install-cli-tools.ps1 [OPTIONS] [TOOL...]"
    Write-Host ""
    Write-Host "Installs CLI binaries used by dex-*-cli plugins."
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -List, -l            List supported tools"
    Write-Host "  -Check, -c           Check what is already installed (no install)"
    Write-Host "  -All, -a             Install all supported tools"
    Write-Host "  -DryRun, -n          Show what would be installed without installing"
    Write-Host "  -VerboseOutput, -v   Show detailed output"
    Write-Host "  -Help, -h            Show this help message"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\install-cli-tools.ps1 -Check               # See what is missing"
    Write-Host "  .\install-cli-tools.ps1 -All                 # Install everything missing"
    Write-Host "  .\install-cli-tools.ps1 psql redis-cli kaf   # Install specific tools"
    Write-Host ""
    Write-Host "Supported tools: $($SupportedTools -join ', ')"
    Write-Host "See docs\CLI_UTILITIES.md for the full install matrix."
    Write-Host ""
}

function Get-ToolDescription {
    param($Tool)
    switch ($Tool) {
        "gh"            { "GitHub CLI (used by dex-github-cli)" }
        "glab"          { "GitLab CLI (used by dex-gitlab-cli)" }
        "kubectl"       { "Kubernetes CLI (used by dex-kubectl-cli)" }
        "psql"          { "PostgreSQL client (used by dex-psql-cli)" }
        "redis-cli"     { "Redis client (used by dex-redis-cli)" }
        "kaf"           { "Kafka client by birdayz (used by dex-kaf-cli)" }
        "rabbitmqadmin" { "RabbitMQ HTTP API CLI (rabbitmqadmin-ng) (used by dex-rabbitmqadmin-cli)" }
        "aws"           { "AWS CLI v2 (used by dex-aws-s3-cli)" }
        default         { "(unknown)" }
    }
}

function Show-ToolList {
    Write-Host ""
    Write-Hdr "Supported tools"
    Write-Host ""
    foreach ($t in $SupportedTools) {
        Write-Host ("  - {0,-12} — {1}" -f $t, (Get-ToolDescription $t))
    }
    Write-Host ""
}

function Test-ToolPresent {
    param($Tool)
    $null = Get-Command $Tool -ErrorAction SilentlyContinue
    return $?
}

function Get-ToolVersion {
    param($Tool)
    if (-not (Test-ToolPresent $Tool)) { return "" }
    try {
        switch ($Tool) {
            "kubectl" { (kubectl version --client --short 2>$null | Select-Object -First 1) }
            default   { (& $Tool --version 2>$null | Select-Object -First 1) }
        }
    } catch { "" }
}

function Get-PackageManager {
    if (Get-Command winget -ErrorAction SilentlyContinue) { return "winget" }
    if (Get-Command scoop  -ErrorAction SilentlyContinue) { return "scoop" }
    if (Get-Command choco  -ErrorAction SilentlyContinue) { return "choco" }
    return $null
}

# Returns array of strings — each string is a shell command to run.
function Get-Recipe {
    param($Tool, $Pm)
    switch ("$($Pm):$Tool") {
        "winget:gh"        { return @("winget install --id GitHub.cli -e --silent") }
        "winget:glab"      { return @("winget install --id GitLab.GLab -e --silent") }
        "winget:kubectl"   { return @("winget install --id Kubernetes.kubectl -e --silent") }
        "winget:psql"      { return @("winget install --id PostgreSQL.PostgreSQL -e --silent") }
        "winget:redis-cli" { return @("winget install --id Redis.Redis -e --silent") }
        "winget:kaf"       { return @("winget install --id Birdayz.kaf -e --silent || scoop install kaf") }

        "scoop:gh"         { return @("scoop install gh") }
        "scoop:glab"       { return @("scoop install glab") }
        "scoop:kubectl"    { return @("scoop install kubectl") }
        "scoop:psql"       { return @("scoop install postgresql") }
        "scoop:redis-cli"  { return @("scoop install redis") }
        "scoop:kaf"        { return @("scoop bucket add extras; scoop install kaf") }

        "choco:gh"             { return @("choco install gh -y") }
        "choco:glab"           { return @("choco install glab -y") }
        "choco:kubectl"        { return @("choco install kubernetes-cli -y") }
        "choco:psql"           { return @("choco install postgresql --params '/Password:postgres' -y") }
        "choco:redis-cli"      { return @("choco install redis-64 -y") }
        "choco:kaf"            { return @("__UNSUPPORTED__") }

        "winget:rabbitmqadmin" { return @("__UNSUPPORTED__") }
        "scoop:rabbitmqadmin"  { return @("__UNSUPPORTED__") }
        "choco:rabbitmqadmin"  { return @("__UNSUPPORTED__") }

        "winget:aws"           { return @("winget install --id Amazon.AWSCLI -e --silent") }
        "scoop:aws"            { return @("scoop install aws") }
        "choco:aws"            { return @("choco install awscli -y") }
    }
    return @("__UNSUPPORTED__")
}

function Invoke-Recipe {
    param($Tool, $Pm)
    $recipe = Get-Recipe $Tool $Pm
    if ($recipe[0] -eq "__UNSUPPORTED__") {
        Write-ErrC "  No recipe for $Tool on $Pm — see docs/CLI_UTILITIES.md install matrix"
        return $false
    }
    foreach ($line in $recipe) {
        if ($DryRun) {
            Write-Dim "    > $line"
        } else {
            if ($VerboseOutput) { Write-Dim "    > $line" }
            $LASTEXITCODE = 0
            cmd /c $line
            if ($LASTEXITCODE -ne 0) {
                Write-ErrC "    Command failed (exit $LASTEXITCODE): $line"
                return $false
            }
        }
    }
    return $true
}

function Process-Tool {
    param($Tool, $Pm, $Idx, $Total)

    if (Test-ToolPresent $Tool) {
        Write-Warn "  [$Idx/$Total] Already installed: $Tool"
        if ($VerboseOutput) {
            $v = Get-ToolVersion $Tool
            if ($v) { Write-Dim "           $v" }
        }
        return 2
    }

    if ($Check) {
        Write-Info "  [$Idx/$Total] Missing: $Tool — $(Get-ToolDescription $Tool)"
        return 0
    }

    if ($DryRun) {
        Write-Info "  [$Idx/$Total] Would install: $Tool"
    } else {
        Write-Info "  [$Idx/$Total] Installing: $Tool"
    }

    if (Invoke-Recipe $Tool $Pm) {
        if (-not $DryRun) {
            $v = Get-ToolVersion $Tool
            if ($v) {
                Write-Ok "           Installed: $v"
                return 0
            } else {
                Write-Warn "           Recipe ran but $Tool not found in PATH — restart shell"
                return 1
            }
        }
        return 0
    }
    return 1
}

# Main
if ($Help) { Show-Help; exit 0 }
if ($List) { Show-ToolList; exit 0 }

# Validate explicit tool names
foreach ($t in $Tools) {
    if ($SupportedTools -notcontains $t) {
        Write-ErrC "Unsupported tool: $t"
        Write-Host "Supported: $($SupportedTools -join ', ')"
        exit 1
    }
}

if ($All) { $Tools = $SupportedTools }
if ($Check -and $Tools.Count -eq 0) { $Tools = $SupportedTools }

if ($Tools.Count -eq 0) {
    Show-Help
    exit 0
}

$pm = Get-PackageManager
if (-not $pm) {
    Write-ErrC "No supported package manager found (winget / scoop / choco)."
    Write-Dim "Install winget (built into Windows 11) or scoop (https://scoop.sh)."
    exit 1
}

Write-Host ""
Write-Hdr "================================================"
if ($Check)  { Write-Hdr "  Checking CLI tools (no install)" }
elseif ($DryRun) { Write-Hdr "  CLI tools install — dry run" }
else { Write-Hdr "  Installing CLI tools" }
Write-Hdr "================================================"
Write-Host ""
Write-Dim "  Package manager: $pm"
Write-Dim "  Tools: $($Tools -join ', ')"
Write-Host ""

$installed = 0; $already = 0; $errors = 0; $missing = 0
$total = $Tools.Count
$idx = 0
foreach ($t in $Tools) {
    $idx++
    $rc = Process-Tool $t $pm $idx $total
    switch ($rc) {
        0 { if ($Check) { $missing++ } else { $installed++ } }
        2 { $already++ }
        default { $errors++ }
    }
}

Write-Host ""
Write-Hdr "================================================"
Write-Hdr "  Summary"
Write-Hdr "================================================"
Write-Host ""

if ($Check) {
    Write-Ok   "  Already installed:  $already"
    Write-Info "  Missing:            $missing"
} elseif ($DryRun) {
    Write-Info "  Would install:      $installed"
    Write-Warn "  Already installed:  $already"
} else {
    Write-Ok   "  Installed:          $installed"
    Write-Warn "  Already installed:  $already"
}

if ($errors -gt 0) { Write-ErrC "  Errors:             $errors" }
Write-Host ""

if ($DryRun) {
    Write-Host "Run without -DryRun to actually install."
    Write-Host ""
}

if ($errors -gt 0) { exit 1 } else { exit 0 }
