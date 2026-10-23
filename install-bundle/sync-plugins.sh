#!/bin/bash

# Plugin Sync for Claude Code Marketplace
#
# Protects INSTALLED agents AND command entry points from degradation: an
# agent loads skills imperatively via the Skill tool, and a command does the
# same to reach the skills it names (`dex-skill-X:Y`), then delegates the work
# to the specialist it names (`dex-X:agent`). Installation is flat - there is
# no specialist->skill, command->skill or command->specialist cascade, so a
# referenced-but-not-installed artefact will not resolve, and the agent or
# command silently degrades. Both edges are reported; only the skill edge is
# auto-installable (--fix), because pulling in a new agent is a deliberate
# decision - see "never installs new agents" below.
#
# This script anchors on what YOU have installed (not on bundles): for every
# installed plugin it reads the skills its agent(s) and/or command(s) load
# from the repo's files (source of truth = the market), and reports/installs
# the non-by-stack skills that are missing. It NEVER installs new agents -
# "something new appeared" is a manual decision. It does NOT touch versions
# (update is a separate manual op via the marketplace).
#
# Third edge, report only: an INSTALLED plugin of this marketplace that the
# catalogue (.claude-plugin/marketplace.json of this clone) no longer lists was
# removed or renamed upstream. Installers never remove anything, so it keeps
# loading by name, with no error. Listed with the uninstall command; never
# removed by --fix (removal is a manual decision, the replacement is in the
# "Renamed and removed plugins" table of install-bundle/README.md).
#
# Requires: jq, claude CLI. Run from a clone of the marketplace repo.
# Runs on the stock macOS /bin/bash 3.2: no associative arrays, no mapfile.
#
# Usage:
#   ./sync-plugins.sh            # report drift only
#   ./sync-plugins.sh --fix      # install missing skills
#   ./sync-plugins.sh --verbose  # show per-agent detail

set -eu

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m'

print_error()   { echo -e "${RED}$*${NC}"; }
print_success() { echo -e "${GREEN}$*${NC}"; }
print_warning() { echo -e "${YELLOW}$*${NC}"; }
print_info()    { echo -e "${CYAN}$*${NC}"; }
print_header()  { echo -e "${MAGENTA}$*${NC}"; }
print_dim()     { echo -e "${GRAY}$*${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SPECIALISTS_DIR="$PROJECT_ROOT/plugins/specialists"
MARKETPLACE_JSON="$PROJECT_ROOT/.claude-plugin/marketplace.json"
MARKETPLACE_NAME="dex-claude-marketplace"

# by-stack profile skill prefixes - loaded conditionally per project stack,
# NOT required to be installed for every agent (see dex-skill-stack-registry).
# Keep in sync with BY_STACK_PREFIXES in tools/validate-bundle.js.
BY_STACK_PREFIXES="dotnet ts python react rabbitmq kafka redis mongodb elasticsearch docker kubernetes gitlab-ci github-actions teamcity jenkins playwright"

FIX=false
VERBOSE=false

show_help() {
  echo "Usage: $0 [OPTIONS]"
  echo ""
  echo "Protects installed agents/commands from skill degradation by syncing the"
  echo "skills they load against what is installed."
  echo ""
  echo "Options:"
  echo "  --fix          Install missing skills (default: report only)"
  echo "  --verbose, -v  Show per-agent detail"
  echo "  --help, -h     Show this help"
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --fix)        FIX=true; shift ;;
    --verbose|-v) VERBOSE=true; shift ;;
    --help|-h)    show_help; exit 0 ;;
    *) print_error "Unknown option: $1"; show_help; exit 1 ;;
  esac
done

check_dependencies() {
  command -v jq >/dev/null 2>&1     || { print_error "jq not found"; exit 1; }
  command -v claude >/dev/null 2>&1 || { print_error "claude CLI not found"; exit 1; }
  [ -d "$SPECIALISTS_DIR" ]         || { print_error "Not in a marketplace clone: $SPECIALISTS_DIR missing"; exit 1; }
  [ -f "$MARKETPLACE_JSON" ]        || { print_error "Not in a marketplace clone: $MARKETPLACE_JSON missing"; exit 1; }
}

is_by_stack() {
  local skill="$1"
  local p
  for p in $BY_STACK_PREFIXES; do
    case "$skill" in
      "dex-skill-${p}-"*|"dex-skill-${p}") return 0 ;;
    esac
  done
  return 1
}

# Installed (enabled) plugin names for our marketplace, one per line.
# `.enabled` is an undocumented field; treat a missing/absent value as enabled
# (`!= false`) so the script never silently no-ops when the CLI omits it.
installed_plugins() {
  claude plugins list --json 2>/dev/null \
    | jq -r --arg m "@$MARKETPLACE_NAME" \
        '.[] | select((.id|endswith($m)) and (.enabled != false)) | .id | sub("@.*";"")' \
    | sort -u
}

# Installed plugin names ($1, one per line) that the catalogue of this clone no
# longer declares, one per line. Both sides sorted in the C locale so comm(1)
# sees a consistent order.
orphaned_plugins() {
  local installed="$1"
  LC_ALL=C comm -23 \
    <(printf '%s\n' "$installed" | LC_ALL=C sort -u) \
    <(jq -r '.plugins[].name' "$MARKETPLACE_JSON" | LC_ALL=C sort -u)
}

# Number of non-empty lines in $1.
count_lines() {
  printf '%s\n' "$1" | awk 'NF{n++} END{print n+0}'
}

# Path to a specialist plugin's agents/ dir in the repo, or empty.
agent_dir_for() {
  local plugin="$1" d
  d=$(find "$SPECIALISTS_DIR" -maxdepth 2 -type d -name "$plugin" 2>/dev/null | head -1)
  [ -n "$d" ] && [ -d "$d/agents" ] && echo "$d/agents"
}

# Path to a plugin's commands/ dir anywhere under plugins/, or empty.
command_dir_for() {
  local plugin="$1" d
  d=$(find "$PROJECT_ROOT/plugins" -maxdepth 3 -type d -name "$plugin" 2>/dev/null | head -1)
  [ -n "$d" ] && [ -d "$d/commands" ] && echo "$d/commands"
}

# Specialists a plugin's command(s)/agent(s) hand work to (dex-X from
# `dex-X:agent`), deduped. `dex-skill-` is excluded - that half is the skill
# edge above. A call marked `[справочно]` right after it names one option out of
# a set (a stack menu) and carries no delivery obligation, so it is dropped -
# same rule the bundle closure uses.
specialists_named_by() {
  local dir="$1"
  grep -rhoE '`dex-[a-z0-9-]+:[a-z0-9-]+`( `\[справочно\]`)?' "$dir" 2>/dev/null \
    | grep -v '`\[справочно\]`' \
    | tr -d '`' \
    | grep -v '^dex-skill-' \
    | sed 's/:.*//' \
    | sort -u
}

# Skills a plugin's agent(s) load (dex-skill-X from `dex-skill-X:Y`), deduped.
skills_loaded_by() {
  local agents_dir="$1"
  grep -rhoE 'dex-skill-[a-z0-9-]+:[a-z0-9-]+' "$agents_dir" 2>/dev/null \
    | sed 's/:.*//' \
    | grep -vE -- '-$' \
    | sort -u
}

main() {
  check_dependencies

  print_header "  Plugin Sync - protecting installed agents/commands from skill degradation"
  echo ""

  local installed missing_total=0 plugins_checked=0 orphans orphan_total=0
  installed=$(installed_plugins)
  [ -z "$installed" ] && { print_warning "No installed plugins from $MARKETPLACE_NAME found."; exit 0; }

  # collect all missing skills / executors across installed agents/commands as
  # "<missing> <needing plugin>" lines (no associative arrays: bash 3.2)
  local MISSING="" MISSING_EXEC=""
  local installed_set=" $(echo "$installed" | tr '\n' ' ') "

  while read -r plugin; do
    [ -z "$plugin" ] && continue
    local agents_dir commands_dir
    agents_dir=$(agent_dir_for "$plugin") || true
    commands_dir=$(command_dir_for "$plugin") || true
    [ -z "$agents_dir" ] && [ -z "$commands_dir" ] && continue
    plugins_checked=$((plugins_checked+1))

    local plugin_missing=""
    while read -r skill; do
      [ -z "$skill" ] && continue
      is_by_stack "$skill" && continue
      case "$installed_set" in *" $skill "*) continue ;; esac   # already installed
      plugin_missing="$plugin_missing $skill"
      MISSING="${MISSING}${skill} ${plugin}"$'\n'
    done < <( { [ -n "$agents_dir" ] && skills_loaded_by "$agents_dir"; [ -n "$commands_dir" ] && skills_loaded_by "$commands_dir"; } | sort -u )

    while read -r exec_plugin; do
      [ -z "$exec_plugin" ] && continue
      [ "$exec_plugin" = "$plugin" ] && continue
      case "$installed_set" in *" $exec_plugin "*) continue ;; esac
      MISSING_EXEC="${MISSING_EXEC}${exec_plugin} ${plugin}"$'\n'
    done < <( { [ -n "$agents_dir" ] && specialists_named_by "$agents_dir"; [ -n "$commands_dir" ] && specialists_named_by "$commands_dir"; } | sort -u )

    if [ "$VERBOSE" = true ] && [ -n "$plugin_missing" ]; then
      print_warning "  $plugin loads missing:"
      for s in $plugin_missing; do print_dim "      $s"; done
    fi
  done <<< "$installed"

  # Executor edge is reported, never auto-installed: pulling in a new agent is a
  # deliberate decision, and --fix must stay a skill-only operation.
  local execs exec_total e
  execs=$(printf '%s' "$MISSING_EXEC" | awk 'NF{print $1}' | sort -u)
  exec_total=$(count_lines "$execs")
  if [ "$exec_total" -gt 0 ]; then
    echo ""
    print_warning "  Missing executors (named by installed agents/commands, not installed): $exec_total"
    for e in $execs; do
      print_info "    $e"
      print_dim  "        named by: $(printf '%s' "$MISSING_EXEC" | awk -v n="$e" '$1==n{print $2}' | sort -u | tr '\n' ' ')"
      print_dim  "        install:  claude plugins install ${e}@${MARKETPLACE_NAME}"
    done
    print_dim "  Not installed by --fix: adding an agent is a manual decision."
  fi

  # Orphan edge, report only: installed here, no longer declared by the catalogue.
  orphans=$(orphaned_plugins "$installed")
  orphan_total=$(count_lines "$orphans")
  if [ "$orphan_total" -gt 0 ]; then
    echo ""
    print_warning "  Installed but no longer in the catalogue (removed or renamed upstream): $orphan_total"
    for e in $orphans; do
      print_info "    $e"
      print_dim  "        remove:  claude plugins uninstall ${e}@${MARKETPLACE_NAME}"
    done
    print_dim "  Not removed by --fix: look the name up in \"Renamed and removed plugins\" in install-bundle/README.md"
    print_dim "  for the replacement. If this clone is behind the marketplace, git pull first - a plugin"
    print_dim "  added after your clone's last update would be listed here as well."
  fi

  local skills skill
  skills=$(printf '%s' "$MISSING" | awk 'NF{print $1}' | sort -u)
  missing_total=$(count_lines "$skills")

  echo ""
  print_dim "  Installed agents/commands checked: $plugins_checked"
  if [ "$missing_total" -eq 0 ]; then
    if [ "$exec_total" -eq 0 ] && [ "$orphan_total" -eq 0 ]; then
      print_success "  All installed agents/commands are closed over their skills and executors, and every installed plugin is still in the catalogue - no drift."
      exit 0
    fi
    if [ "$exec_total" -eq 0 ]; then
      print_success "  All installed agents/commands are closed over their skills and executors; orphaned plugins above are not."
    else
      print_success "  All installed agents/commands are closed over their skills; executors above are not."
    fi
    exit 0
  fi

  print_warning "  Missing skills (loaded by installed agents/commands, not installed): $missing_total"
  for skill in $skills; do
    print_info "    $skill"
    print_dim  "        needed by: $(printf '%s' "$MISSING" | awk -v n="$skill" '$1==n{print $2}' | sort -u | tr '\n' ' ')"
  done
  echo ""

  if [ "$FIX" != true ]; then
    print_dim "  Run with --fix to install the missing skills."
    exit 0
  fi

  print_header "  Installing missing skills..."
  local ok=0 fail=0
  for skill in $skills; do
    # only install if declared in marketplace.json (else CLI errors)
    if ! jq -e --arg n "$skill" '.plugins[]|select(.name==$n)' "$MARKETPLACE_JSON" >/dev/null 2>&1; then
      print_error "    ✗ $skill - not declared in marketplace.json, skipping"
      fail=$((fail+1)); continue
    fi
    if claude plugins install "${skill}@${MARKETPLACE_NAME}" >/dev/null 2>&1; then
      print_success "    ✓ $skill"; ok=$((ok+1))
    else
      print_error "    ✗ $skill - install failed"; fail=$((fail+1))
    fi
  done
  echo ""
  print_dim "  Installed: $ok, failed: $fail"
  [ "$fail" -eq 0 ] || exit 1
}

main
