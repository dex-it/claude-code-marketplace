#!/bin/bash

# Plugin Sync for Claude Code Marketplace
#
# Protects INSTALLED agents from degradation: an agent loads skills imperatively
# via the Skill tool (`dex-skill-X:Y`). Installation is flat — there is no
# specialist→skill cascade, so a skill an agent loads but that is not installed
# will not resolve, and the agent silently degrades.
#
# This script anchors on what YOU have installed (not on bundles): for every
# installed agent it reads the skills that agent loads from the repo's agent
# files (source of truth = the market), and reports/installs the non-by-stack
# skills that are missing. It NEVER installs new agents — "something new
# appeared" is a manual decision. It does NOT touch versions (update is a
# separate manual op via the marketplace).
#
# Requires: jq, claude CLI. Run from a clone of the marketplace repo.
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

# by-stack profile skill prefixes — loaded conditionally per project stack,
# NOT required to be installed for every agent (see dex-skill-stack-registry).
# Keep in sync with BY_STACK_PREFIXES in tools/validate-bundle.js.
BY_STACK_PREFIXES="dotnet ts python react rabbitmq kafka redis mongodb elasticsearch docker kubernetes gitlab-ci github-actions teamcity jenkins playwright"

FIX=false
VERBOSE=false

show_help() {
  echo "Usage: $0 [OPTIONS]"
  echo ""
  echo "Protects installed agents from skill degradation by syncing the skills"
  echo "they load against what is installed."
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

# Path to a specialist plugin's agents/ dir in the repo, or empty.
agent_dir_for() {
  local plugin="$1" d
  d=$(find "$SPECIALISTS_DIR" -maxdepth 2 -type d -name "$plugin" 2>/dev/null | head -1)
  [ -n "$d" ] && [ -d "$d/agents" ] && echo "$d/agents"
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

  print_header "  Plugin Sync — protecting installed agents from skill degradation"
  echo ""

  local installed missing_total=0 agents_checked=0
  installed=$(installed_plugins)
  [ -z "$installed" ] && { print_warning "No installed plugins from $MARKETPLACE_NAME found."; exit 0; }

  # collect all unique missing skills across installed agents
  local -A MISSING=()      # skill -> "agent1 agent2"
  local installed_set=" $(echo "$installed" | tr '\n' ' ') "

  while read -r plugin; do
    [ -z "$plugin" ] && continue
    local agents_dir; agents_dir=$(agent_dir_for "$plugin") || continue
    [ -z "$agents_dir" ] && continue
    agents_checked=$((agents_checked+1))

    local agent_missing=""
    while read -r skill; do
      [ -z "$skill" ] && continue
      is_by_stack "$skill" && continue
      case "$installed_set" in *" $skill "*) continue ;; esac   # already installed
      agent_missing="$agent_missing $skill"
      MISSING["$skill"]="${MISSING[$skill]:-}$plugin "
    done < <(skills_loaded_by "$agents_dir")

    if [ "$VERBOSE" = true ] && [ -n "$agent_missing" ]; then
      print_warning "  $plugin loads missing:"
      for s in $agent_missing; do print_dim "      $s"; done
    fi
  done <<< "$installed"

  local skills=("${!MISSING[@]}")
  missing_total=${#skills[@]}

  echo ""
  print_dim "  Installed agents checked: $agents_checked"
  if [ "$missing_total" -eq 0 ]; then
    print_success "  All installed agents are closed over their skills — no drift."
    exit 0
  fi

  print_warning "  Missing skills (loaded by installed agents, not installed): $missing_total"
  for skill in $(printf '%s\n' "${skills[@]}" | sort); do
    print_info "    $skill"
    print_dim  "        needed by: $(echo "${MISSING[$skill]}" | tr ' ' '\n' | sort -u | tr '\n' ' ')"
  done
  echo ""

  if [ "$FIX" != true ]; then
    print_dim "  Run with --fix to install the missing skills."
    exit 0
  fi

  print_header "  Installing missing skills..."
  local ok=0 fail=0
  for skill in $(printf '%s\n' "${skills[@]}" | sort); do
    # only install if declared in marketplace.json (else CLI errors)
    if ! jq -e --arg n "$skill" '.plugins[]|select(.name==$n)' "$MARKETPLACE_JSON" >/dev/null 2>&1; then
      print_error "    ✗ $skill — not declared in marketplace.json, skipping"
      fail=$((fail+1)); continue
    fi
    if claude plugins install "${skill}@${MARKETPLACE_NAME}" >/dev/null 2>&1; then
      print_success "    ✓ $skill"; ok=$((ok+1))
    else
      print_error "    ✗ $skill — install failed"; fail=$((fail+1))
    fi
  done
  echo ""
  print_dim "  Installed: $ok, failed: $fail"
  [ "$fail" -eq 0 ] || exit 1
}

main
