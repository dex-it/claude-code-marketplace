#!/bin/bash

# Bundle Updater for Claude Code Marketplace
# Reinstalls (uninstall + install) all installed dex-plugins
# Requires: claude CLI

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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
    print_header "  Update All Installed Plugins"
    print_header "======================================"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Reinstalls all installed dex-* plugins (uninstall + install)."
    echo "Use this after pulling new versions from the marketplace repository."
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

# Get installed dex-plugins as "name@marketplace" lines
get_installed_dex_plugins() {
    claude plugins list --json 2>/dev/null \
        | jq -r '.[] | select(.id | startswith("dex-")) | .id'
}

# Update all installed dex-plugins
update_all() {
    echo ""
    print_header "======================================"
    print_header "  Updating All Installed Plugins"
    print_header "======================================"
    echo ""

    # Get installed dex-plugins
    local plugins
    plugins=$(get_installed_dex_plugins)

    if [ -z "$plugins" ]; then
        print_warning "  No dex-* plugins installed. Nothing to update."
        echo ""
        return 0
    fi

    local total
    total=$(echo "$plugins" | wc -l)
    print_info "  Plugins to update: $total"
    echo ""

    if [ "$DRY_RUN" = true ]; then
        print_warning "  [DRY RUN] No actual changes will be made"
        echo ""
    fi

    # Counters
    local updated=0
    local errors=0
    local component_num=0

    # Process each plugin
    while IFS= read -r plugin_ref; do
        ((component_num++))

        # Split name@marketplace
        local plugin_name="${plugin_ref%%@*}"
        local marketplace="${plugin_ref#*@}"

        if [ "$DRY_RUN" = true ]; then
            print_info "  [$component_num/$total] Would update: $plugin_name"
            if [ "$VERBOSE" = true ]; then
                print_dim "           Ref: $plugin_ref"
            fi
            ((updated++))
            continue
        fi

        print_info "  [$component_num/$total] Updating: $plugin_name"
        if [ "$VERBOSE" = true ]; then
            print_dim "           Ref: $plugin_ref"
        fi

        # Phase 1: Uninstall
        if [ "$VERBOSE" = true ]; then
            print_dim "           Removing..."
        fi
        local uninstall_output
        uninstall_output=$(claude plugins uninstall "$plugin_name" 2>&1)
        if [ $? -ne 0 ]; then
            print_error "           Failed to uninstall: $uninstall_output"
            ((errors++))
            continue
        fi

        # Phase 2: Install
        if [ "$VERBOSE" = true ]; then
            print_dim "           Installing..."
        fi
        local install_output
        install_output=$(claude plugins install "$plugin_ref" 2>&1)
        if [ $? -eq 0 ]; then
            print_success "           Updated successfully"
            ((updated++))
        else
            print_error "           Failed to install: $install_output"
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
        print_info "  Would update:  $updated"
    else
        print_success "  Updated:  $updated"
    fi

    if [ $errors -gt 0 ]; then
        print_error "  Errors:   $errors"
    fi

    echo ""

    if [ "$DRY_RUN" = true ]; then
        echo "Run without --dry-run to actually update."
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
            print_info "This script updates ALL installed dex-plugins. No bundle name needed."
            echo ""
            show_help
            exit 1
            ;;
    esac
done

check_dependencies
update_all
exit $?
