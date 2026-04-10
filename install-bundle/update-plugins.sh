#!/bin/bash

# Plugin Updater for Claude Code Marketplace
# Updates all installed dex-* plugins to the latest version
# Uses `claude plugin update` (atomic, safe, official CLI command).
# Requires: jq, claude CLI

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Output functions
print_error() { echo -e "${RED}$@${NC}"; }
print_success() { echo -e "${GREEN}$@${NC}"; }
print_warning() { echo -e "${YELLOW}$@${NC}"; }
print_info() { echo -e "${CYAN}$@${NC}"; }
print_header() { echo -e "${MAGENTA}$@${NC}"; }
print_dim() { echo -e "${GRAY}$@${NC}"; }

# Flags
DRY_RUN=false
VERBOSE=false

# Show help
show_help() {
    echo ""
    print_header "======================================"
    print_header "  Update All Installed dex-Plugins"
    print_header "======================================"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Updates all installed dex-* plugins (bundles, specialists, skills,"
    echo "utilities) to the latest version using \`claude plugin update\`."
    echo ""
    echo "Restart Claude Code after running this script to apply updates."
    echo ""
    echo "Options:"
    echo "  --dry-run, -n    Show what would be updated without changes"
    echo "  --verbose, -v    Show detailed output"
    echo "  --help, -h       Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0               # Update all installed dex-plugins"
    echo "  $0 --dry-run     # Preview what would be updated"
    echo ""
}

# Get installed dex-plugin ids (format: name@marketplace).
# NOTE: `claude plugins list --json` and the `.id` field are undocumented CLI
# internals — official docs (code.claude.com) only document install, uninstall,
# enable, disable, update, validate. If the command or schema changes, this
# function returns empty and the script reports "no plugins" instead of crashing.
get_installed_dex_plugins() {
    claude plugins list --json 2>/dev/null \
        | jq -r '.[] | select(.id | startswith("dex-")) | .id'
}

# Update all installed dex-plugins
update_all() {
    echo ""
    print_header "======================================"
    print_header "  Updating All Installed dex-Plugins"
    print_header "======================================"
    echo ""

    local plugins
    plugins=$(get_installed_dex_plugins)

    if [ -z "$plugins" ]; then
        print_warning "  No dex-* plugins installed. Nothing to update."
        echo ""
        return 0
    fi

    local total
    total=$(echo "$plugins" | wc -l)
    print_info "  Plugins to check: $total"
    echo ""

    if [ "$DRY_RUN" = true ]; then
        print_warning "  [DRY RUN] No actual changes will be made"
        echo ""
    fi

    # Counters
    local updated=0
    local already=0
    local errors=0
    local component_num=0

    while IFS= read -r plugin_ref; do
        ((component_num++))
        local plugin_name="${plugin_ref%%@*}"

        if [ "$DRY_RUN" = true ]; then
            print_info "  [$component_num/$total] Would update: $plugin_name"
            if [ "$VERBOSE" = true ]; then
                print_dim "           Ref: $plugin_ref"
            fi
            ((updated++))
            continue
        fi

        print_info "  [$component_num/$total] Checking: $plugin_name"
        if [ "$VERBOSE" = true ]; then
            print_dim "           Ref: $plugin_ref"
        fi

        # `claude plugin update` is atomic — on failure the plugin stays at its
        # current version, no risk of ending up in a half-installed state.
        local output
        output=$(claude plugin update "$plugin_ref" 2>&1)
        local exit_code=$?

        if [ $exit_code -eq 0 ]; then
            # CLI prints "already at the latest version" when nothing to update
            if echo "$output" | grep -qi "already at the latest"; then
                print_warning "           Already at latest version"
                ((already++))
            else
                print_success "           Updated successfully"
                ((updated++))
            fi
        else
            print_error "           Failed: $output"
            ((errors++))
        fi
    done <<< "$plugins"

    # Summary
    echo ""
    print_header "======================================"
    print_header "  Summary"
    print_header "======================================"
    echo ""

    if [ "$DRY_RUN" = true ]; then
        print_info "  Would check:  $updated"
    else
        print_success "  Updated:         $updated"
        print_warning "  Already latest:  $already"
    fi

    if [ $errors -gt 0 ]; then
        print_error "  Errors:          $errors"
    fi

    echo ""

    if [ "$DRY_RUN" = true ]; then
        echo "Run without --dry-run to actually update."
        echo ""
    elif [ $updated -gt 0 ]; then
        print_warning "  Restart Claude Code to apply updates."
        echo ""
    fi

    if [ $errors -gt 0 ]; then
        return 1
    fi
    return 0
}

# Check dependencies
check_dependencies() {
    local missing=false

    if ! command -v jq &> /dev/null; then
        print_error "Error: jq is required but not installed."
        print_info "Install with: apt install jq (Linux) or brew install jq (Mac)"
        missing=true
    fi

    if ! command -v claude &> /dev/null; then
        print_error "Error: claude CLI is required but not installed."
        print_info "Install Claude Code: https://claude.ai/code"
        missing=true
    fi

    if [ "$missing" = true ]; then
        exit 1
    fi
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run|-n)
            DRY_RUN=true
            shift
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        -*)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
        *)
            print_error "Unexpected argument: $1"
            print_info "This script updates ALL installed dex-plugins. No arguments needed."
            echo ""
            show_help
            exit 1
            ;;
    esac
done

check_dependencies
update_all
exit $?
