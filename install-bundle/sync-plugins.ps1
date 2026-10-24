# Plugin Sync for Claude Code Marketplace (PowerShell mirror of sync-plugins.sh)
#
# Protects INSTALLED agents AND command entry points from degradation: an
# agent loads skills imperatively via the Skill tool, and a command does the
# same to reach the skills it names (`dex-skill-X:Y`), then delegates the work
# to the specialist it names (`dex-X:agent`). Installation is flat - there is
# no specialist->skill, command->skill or command->specialist cascade, so a
# referenced-but-not-installed artefact will not resolve, and the agent or
# command silently degrades. Both edges are reported; only the skill edge is
# auto-installable (-Fix), because pulling in a new agent is a deliberate
# decision.
#
# This script anchors on what YOU have installed (not on bundles): for every
# installed plugin it reads the skills its agent(s) and/or command(s) load
# from the repo's files (source of truth = the market), and reports/installs
# the non-by-stack skills that are missing. It NEVER installs new agents.
# It does NOT touch versions (update is a separate manual op via the marketplace).
#
# Third edge, report only: an INSTALLED plugin of this marketplace that the
# catalogue (.claude-plugin/marketplace.json of this clone) no longer lists was
# removed or renamed upstream. Installers never remove anything, so it keeps
# loading by name, with no error. Listed with the uninstall command; never
# removed by -Fix (removal is a manual decision, the replacement is in the
# "Renamed and removed plugins" table of install-bundle/README.md).
#
# Requires: PowerShell 5.1+, claude CLI (no jq). Run from a clone of the
# marketplace repo. Keep the output texts and the by-stack list identical to
# sync-plugins.sh: tests/tools/sync-plugins.test.sh runs both against one set of
# scenarios. The file is pure ASCII on purpose: Windows PowerShell 5.1 reads a
# BOM-less script as ANSI, so the one Cyrillic marker is built from escapes.
#
# Usage:
#   .\sync-plugins.ps1            # report drift only
#   .\sync-plugins.ps1 -Fix       # install missing skills
#   .\sync-plugins.ps1 -Verbose   # show per-agent detail

param(
    [switch]$Fix,

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

# Paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$PluginsDir = Join-Path $ProjectRoot "plugins"
$SpecialistsDir = Join-Path $PluginsDir "specialists"
$MarketplaceJson = Join-Path (Join-Path $ProjectRoot ".claude-plugin") "marketplace.json"
$MarketplaceName = "dex-claude-marketplace"

# by-stack profile skill prefixes - loaded conditionally per project stack,
# NOT required to be installed for every agent (see dex-skill-stack-registry).
# Keep in sync with BY_STACK_PREFIXES in sync-plugins.sh and tools/validate-bundle.js.
$ByStackPrefixes = "dotnet ts python react rabbitmq kafka redis mongodb elasticsearch docker kubernetes gitlab-ci github-actions teamcity jenkins playwright".Split(" ")

# A call marked with this word right after it names one option out of a set
# (a stack menu) and carries no delivery obligation (Cyrillic, built from escapes).
$ReferenceOnlyWord = [regex]::Unescape('\u0441\u043f\u0440\u0430\u0432\u043e\u0447\u043d\u043e')

function Show-Help {
    Write-Host "Usage: .\sync-plugins.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "Protects installed agents/commands from skill degradation by syncing the"
    Write-Host "skills they load against what is installed."
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Fix            Install missing skills (default: report only)"
    Write-Host "  -Verbose, -v    Show per-agent detail"
    Write-Host "  -Help, -h       Show this help"
}

function Test-Dependencies {
    if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
        Write-Error-Colored "claude CLI not found"
        exit 1
    }
    if (-not (Test-Path -LiteralPath $SpecialistsDir -PathType Container)) {
        Write-Error-Colored "Not in a marketplace clone: $SpecialistsDir missing"
        exit 1
    }
    if (-not (Test-Path -LiteralPath $MarketplaceJson -PathType Leaf)) {
        Write-Error-Colored "Not in a marketplace clone: $MarketplaceJson missing"
        exit 1
    }
}

function Test-ByStack {
    param([string]$Skill)
    foreach ($p in $ByStackPrefixes) {
        if ($Skill -eq "dex-skill-$p" -or $Skill.StartsWith("dex-skill-$p-")) { return $true }
    }
    return $false
}

# Installed (enabled) plugin names for our marketplace.
# `.enabled` is an undocumented field; treat a missing/absent value as enabled
# (-ne $false) so the script never silently no-ops when the CLI omits it.
function Get-InstalledPlugins {
    $names = New-Object 'System.Collections.Generic.List[string]'
    $suffix = "@$MarketplaceName"
    try {
        $output = & claude plugins list --json 2>$null
        if ($output) {
            $list = ($output | Out-String) | ConvertFrom-Json
            foreach ($p in @($list)) {
                if (-not $p.id) { continue }
                if (-not ([string]$p.id).EndsWith($suffix)) { continue }
                if ($p.enabled -eq $false) { continue }
                $names.Add(([string]$p.id).Substring(0, ([string]$p.id).Length - $suffix.Length))
            }
        }
    } catch {
        # unreadable list -> no installed plugins, reported by the caller
    }
    return @($names | Sort-Object -Unique)
}

# Names declared by the catalogue of this clone.
function Get-CatalogueNames {
    $json = [System.IO.File]::ReadAllText($MarketplaceJson, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
    return @($json.plugins | ForEach-Object { $_.name })
}

# Installed plugin names that the catalogue of this clone no longer declares.
function Get-OrphanedPlugins {
    param([string[]]$Installed, [string[]]$Catalogue)
    $known = New-Object 'System.Collections.Generic.HashSet[string]' (, [string[]]$Catalogue)
    return @($Installed | Where-Object { -not $known.Contains($_) } | Sort-Object -Unique)
}

# First directory called $Plugin up to $MaxDepth levels under $Root (find -maxdepth analogue),
# or $null. Sorted by path so the pick is stable.
function Find-PluginDir {
    param([string]$Root, [string]$Plugin, [int]$MaxDepth)
    $dir = Get-ChildItem -LiteralPath $Root -Directory -Recurse -Depth ($MaxDepth - 1) -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -ceq $Plugin } |
        Sort-Object FullName |
        Select-Object -First 1
    if ($dir) { return $dir.FullName }
    return $null
}

# Path to a specialist plugin's agents/ dir in the repo, or $null.
function Get-AgentDir {
    param([string]$Plugin)
    $d = Find-PluginDir -Root $SpecialistsDir -Plugin $Plugin -MaxDepth 2
    if ($d) {
        $a = Join-Path $d "agents"
        if (Test-Path -LiteralPath $a -PathType Container) { return $a }
    }
    return $null
}

# Path to a plugin's commands/ dir anywhere under plugins/, or $null.
function Get-CommandDir {
    param([string]$Plugin)
    $d = Find-PluginDir -Root $PluginsDir -Plugin $Plugin -MaxDepth 3
    if ($d) {
        $c = Join-Path $d "commands"
        if (Test-Path -LiteralPath $c -PathType Container) { return $c }
    }
    return $null
}

# Text of every file under $Dir (grep -r analogue), UTF-8.
function Read-AllText {
    param([string]$Dir)
    $texts = New-Object 'System.Collections.Generic.List[string]'
    foreach ($f in (Get-ChildItem -LiteralPath $Dir -File -Recurse -ErrorAction SilentlyContinue)) {
        $texts.Add([System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8))
    }
    return $texts
}

# Specialists a plugin's command(s)/agent(s) hand work to (dex-X from
# `dex-X:agent`), deduped. `dex-skill-` is excluded - that half is the skill
# edge. A call marked as reference-only right after it names one option out of
# a set (a stack menu) and carries no delivery obligation, so it is dropped -
# same rule the bundle closure uses.
function Get-SpecialistsNamedBy {
    param([string]$Dir)
    $re = '`dex-[a-z0-9-]+:[a-z0-9-]+`( `\[' + $ReferenceOnlyWord + '\]`)?'
    $found = New-Object 'System.Collections.Generic.List[string]'
    foreach ($text in (Read-AllText -Dir $Dir)) {
        foreach ($m in [regex]::Matches($text, $re)) {
            if ($m.Groups[1].Success) { continue }
            $call = $m.Value.Replace('`', '')
            if ($call.StartsWith("dex-skill-")) { continue }
            $found.Add($call.Substring(0, $call.IndexOf(':')))
        }
    }
    return @($found | Sort-Object -Unique)
}

# Skills a plugin's agent(s) load (dex-skill-X from `dex-skill-X:Y`), deduped.
function Get-SkillsLoadedBy {
    param([string]$Dir)
    $found = New-Object 'System.Collections.Generic.List[string]'
    foreach ($text in (Read-AllText -Dir $Dir)) {
        foreach ($m in [regex]::Matches($text, 'dex-skill-[a-z0-9-]+:[a-z0-9-]+')) {
            $skill = $m.Value.Substring(0, $m.Value.IndexOf(':'))
            if ($skill.EndsWith("-")) { continue }
            $found.Add($skill)
        }
    }
    return @($found | Sort-Object -Unique)
}

function Invoke-Sync {
    Test-Dependencies

    Write-Header "  Plugin Sync - protecting installed agents/commands from skill degradation"
    Write-Host ""

    $installed = @(Get-InstalledPlugins)
    if ($installed.Count -eq 0) {
        Write-Warning-Colored "No installed plugins from $MarketplaceName found."
        exit 0
    }
    $catalogue = @(Get-CatalogueNames)

    $pluginsChecked = 0
    # "<missing> <needing plugin>" pairs
    $missing = New-Object 'System.Collections.Generic.List[object]'
    $missingExec = New-Object 'System.Collections.Generic.List[object]'
    $installedSet = New-Object 'System.Collections.Generic.HashSet[string]' (, [string[]]$installed)

    foreach ($plugin in $installed) {
        $agentsDir = Get-AgentDir -Plugin $plugin
        $commandsDir = Get-CommandDir -Plugin $plugin
        if (-not $agentsDir -and -not $commandsDir) { continue }
        $pluginsChecked++

        $skills = @()
        $execs = @()
        foreach ($dir in @($agentsDir, $commandsDir)) {
            if (-not $dir) { continue }
            $skills += @(Get-SkillsLoadedBy -Dir $dir)
            $execs += @(Get-SpecialistsNamedBy -Dir $dir)
        }

        $pluginMissing = @()
        foreach ($skill in @($skills | Sort-Object -Unique)) {
            if (-not $skill) { continue }
            if (Test-ByStack -Skill $skill) { continue }
            if ($installedSet.Contains($skill)) { continue }   # already installed
            $pluginMissing += $skill
            $missing.Add([pscustomobject]@{ Name = $skill; Plugin = $plugin })
        }

        foreach ($execPlugin in @($execs | Sort-Object -Unique)) {
            if (-not $execPlugin) { continue }
            if ($execPlugin -eq $plugin) { continue }
            if ($installedSet.Contains($execPlugin)) { continue }
            $missingExec.Add([pscustomobject]@{ Name = $execPlugin; Plugin = $plugin })
        }

        if ($Verbose -and $pluginMissing.Count -gt 0) {
            Write-Warning-Colored "  $plugin loads missing:"
            foreach ($s in $pluginMissing) { Write-Dim "      $s" }
        }
    }

    # Executor edge is reported, never auto-installed: pulling in a new agent is a
    # deliberate decision, and -Fix must stay a skill-only operation.
    $execNames = @($missingExec | ForEach-Object { $_.Name } | Sort-Object -Unique)
    $execTotal = $execNames.Count
    if ($execTotal -gt 0) {
        Write-Host ""
        Write-Warning-Colored "  Missing executors (named by installed agents/commands, not installed): $execTotal"
        foreach ($e in $execNames) {
            $by = (@($missingExec | Where-Object { $_.Name -ceq $e } | ForEach-Object { $_.Plugin } | Sort-Object -Unique)) -join " "
            Write-Info "    $e"
            Write-Dim  "        named by: $by "
            Write-Dim  "        install:  claude plugins install $e@$MarketplaceName"
        }
        Write-Dim "  Not installed by -Fix: adding an agent is a manual decision."
    }

    # Orphan edge, report only: installed here, no longer declared by the catalogue.
    $orphans = @(Get-OrphanedPlugins -Installed $installed -Catalogue $catalogue)
    $orphanTotal = $orphans.Count
    if ($orphanTotal -gt 0) {
        Write-Host ""
        Write-Warning-Colored "  Installed but no longer in the catalogue (removed or renamed upstream): $orphanTotal"
        foreach ($e in $orphans) {
            Write-Info "    $e"
            Write-Dim  "        remove:  claude plugins uninstall $e@$MarketplaceName"
        }
        Write-Dim "  Not removed by -Fix: look the name up in `"Renamed and removed plugins`" in install-bundle/README.md"
        Write-Dim "  for the replacement. If this clone is behind the marketplace, git pull first - a plugin"
        Write-Dim "  added after your clone's last update would be listed here as well."
    }

    $skillNames = @($missing | ForEach-Object { $_.Name } | Sort-Object -Unique)
    $missingTotal = $skillNames.Count

    Write-Host ""
    Write-Dim "  Installed agents/commands checked: $pluginsChecked"
    if ($missingTotal -eq 0) {
        if ($execTotal -eq 0 -and $orphanTotal -eq 0) {
            Write-Success "  All installed agents/commands are closed over their skills and executors, and every installed plugin is still in the catalogue - no drift."
            exit 0
        }
        if ($execTotal -eq 0) {
            Write-Success "  All installed agents/commands are closed over their skills and executors; orphaned plugins above are not."
        } else {
            Write-Success "  All installed agents/commands are closed over their skills; executors above are not."
        }
        exit 0
    }

    Write-Warning-Colored "  Missing skills (loaded by installed agents/commands, not installed): $missingTotal"
    foreach ($skill in $skillNames) {
        $by = (@($missing | Where-Object { $_.Name -ceq $skill } | ForEach-Object { $_.Plugin } | Sort-Object -Unique)) -join " "
        Write-Info "    $skill"
        Write-Dim  "        needed by: $by "
    }
    Write-Host ""

    if (-not $Fix) {
        Write-Dim "  Run with -Fix to install the missing skills."
        exit 0
    }

    Write-Header "  Installing missing skills..."
    $ok = 0
    $fail = 0
    foreach ($skill in $skillNames) {
        # only install if declared in marketplace.json (else CLI errors)
        if ($catalogue -cnotcontains $skill) {
            Write-Error-Colored "    [x] $skill - not declared in marketplace.json, skipping"
            $fail++
            continue
        }
        & claude plugins install "$skill@$MarketplaceName" *> $null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "    [ok] $skill"
            $ok++
        } else {
            Write-Error-Colored "    [x] $skill - install failed"
            $fail++
        }
    }
    Write-Host ""
    Write-Dim "  Installed: $ok, failed: $fail"
    if ($fail -ne 0) { exit 1 }
    exit 0
}

# Main logic
if ($Help) {
    Show-Help
    exit 0
}

Invoke-Sync
