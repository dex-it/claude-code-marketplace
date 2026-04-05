#!/bin/bash

# Bundle Installer for Claude Code Marketplace
# Installs all components listed in bundle.json
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

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUNDLES_DIR="$PROJECT_ROOT/plugins/bundles"
MARKETPLACE_JSON="$PROJECT_ROOT/.claude-plugin/marketplace.json"

# Flags
DRY_RUN=false
VERBOSE=false

# Show help
show_help() {
    echo ""
    print_header "======================================"
    print_header "  Bundle Installer for Claude Code"
    print_header "======================================"
    echo ""
    echo "Usage: $0 [OPTIONS] [BUNDLE_NAME]"
    echo ""
    echo "Options:"
    echo "  --list, -l       List all available bundles"
    echo "  --dry-run, -n    Show what would be installed without installing"
    echo "  --verbose, -v    Show detailed output"
    echo "  --help, -h       Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --list                    # Show all bundles"
    echo "  $0 dotnet-developer          # Install .NET Developer bundle"
    echo "  $0 dotnet-developer --dry-run # Preview installation"
    echo ""
    echo "Available bundles:"
    list_bundles_short
    echo ""
}

# List bundles (short format)
list_bundles_short() {
    if [ ! -d "$BUNDLES_DIR" ]; then
        print_error "  Bundles directory not found: $BUNDLES_DIR"
        return 1
    fi

    for bundle_dir in "$BUNDLES_DIR"/dex-bundle-*; do
        if [ -d "$bundle_dir" ]; then
            bundle_name=$(basename "$bundle_dir" | sed 's/^dex-bundle-//')
            echo "  - $bundle_name"
        fi
    done
}

# List bundles (detailed)
list_bundles() {
    echo ""
    print_header "======================================"
    print_header "  Available Bundles"
    print_header "======================================"
    echo ""

    if [ ! -d "$BUNDLES_DIR" ]; then
        print_error "Bundles directory not found: $BUNDLES_DIR"
        return 1
    fi

    for bundle_dir in "$BUNDLES_DIR"/dex-bundle-*; do
        if [ -d "$bundle_dir" ]; then
            plugin_json="$bundle_dir/.claude-plugin/plugin.json"
            bundle_json="$bundle_dir/bundle.json"
            if [ -f "$plugin_json" ] && [ -f "$bundle_json" ]; then
                bundle_name=$(basename "$bundle_dir" | sed 's/^dex-bundle-//')
                description=$(jq -r '.description // "No description"' "$plugin_json")
                includes_count=$(jq -r '.includes | length' "$bundle_json")

                print_info "  $bundle_name"
                print_dim "    $description"
                print_dim "    Components: $includes_count"
                echo ""
            fi
        fi
    done

    echo "Usage: $0 <bundle-name>"
    echo ""
}

# Check that a plugin exists in marketplace.json (returns 0 if found)
plugin_exists_in_marketplace() {
    local plugin_name="$1"
    local found
    found=$(jq -r --arg name "$plugin_name" '.plugins[] | select(.name == $name) | .name // empty' "$MARKETPLACE_JSON")
    [ -n "$found" ]
}

# Get marketplace name from marketplace.json
get_marketplace_name() {
    jq -r '.name // empty' "$MARKETPLACE_JSON"
}

# List already-installed plugin ids (format: name@marketplace) as newline-separated list.
# `claude plugins install` is idempotent and always reports success, so we pre-fetch the
# list once per bundle and check membership locally to produce honest "already installed" counts.
get_installed_plugin_ids() {
    claude plugins list --json 2>/dev/null | jq -r '.[].id // empty'
}

# Check whether a plugin ref is present in the pre-fetched installed list
# $1 = plugin_ref (name@marketplace), $2 = newline-separated installed ids
is_plugin_installed() {
    local plugin_ref="$1"
    local installed_list="$2"
    printf '%s\n' "$installed_list" | grep -Fxq "$plugin_ref"
}

# Install a single component via `claude plugins install name@marketplace`.
# Exit codes: 0 = freshly installed, 2 = already installed, 1 = error
install_component() {
    local component_name="$1"
    local marketplace_name="$2"
    local component_num="$3"
    local total="$4"
    local installed_list="$5"
    local plugin_ref="${component_name}@${marketplace_name}"

    if [ "$DRY_RUN" = true ]; then
        if is_plugin_installed "$plugin_ref" "$installed_list"; then
            print_warning "  [$component_num/$total] Already installed: $component_name"
            if [ "$VERBOSE" = true ]; then
                print_dim "           Ref: $plugin_ref"
            fi
            return 2
        fi
        print_info "  [$component_num/$total] Would install: $component_name"
        if [ "$VERBOSE" = true ]; then
            print_dim "           Ref: $plugin_ref"
        fi
        return 0
    fi

    if is_plugin_installed "$plugin_ref" "$installed_list"; then
        print_warning "  [$component_num/$total] Already installed: $component_name"
        if [ "$VERBOSE" = true ]; then
            print_dim "           Ref: $plugin_ref"
        fi
        return 2
    fi

    print_info "  [$component_num/$total] Installing: $component_name"
    if [ "$VERBOSE" = true ]; then
        print_dim "           Ref: $plugin_ref"
    fi

    # Run claude plugins install
    local output
    output=$(claude plugins install "$plugin_ref" 2>&1)
    local exit_code=$?

    if [ $exit_code -eq 0 ]; then
        print_success "           Installed successfully"
        return 0
    else
        print_error "           Failed: $output"
        return 1
    fi
}

# Install bundle
install_bundle() {
    local bundle_name="$1"
    local bundle_dir="$BUNDLES_DIR/dex-bundle-$bundle_name"
    local plugin_json="$bundle_dir/.claude-plugin/plugin.json"
    local bundle_json="$bundle_dir/bundle.json"

    # Check if bundle exists
    if [ ! -d "$bundle_dir" ]; then
        print_error "Bundle not found: $bundle_name"
        echo ""
        echo "Available bundles:"
        list_bundles_short
        echo ""
        return 1
    fi

    if [ ! -f "$bundle_json" ]; then
        print_error "bundle.json not found in bundle: $bundle_name"
        return 1
    fi

    # Check marketplace.json exists
    if [ ! -f "$MARKETPLACE_JSON" ]; then
        print_error "marketplace.json not found: $MARKETPLACE_JSON"
        return 1
    fi

    # Get bundle info
    local description=$(jq -r '.description // "No description"' "$plugin_json" 2>/dev/null || echo "No description")
    local includes=$(jq -r '.includes[]' "$bundle_json")
    local total=$(jq -r '.includes | length' "$bundle_json")

    echo ""
    print_header "======================================"
    print_header "  Installing Bundle: $bundle_name"
    print_header "======================================"
    echo ""
    print_dim "  $description"
    echo ""
    print_info "  Components to install: $total"
    echo ""

    if [ "$DRY_RUN" = true ]; then
        print_warning "  [DRY RUN] No actual installation will be performed"
        echo ""
    fi

    # Resolve marketplace name (used as @marketplace suffix for claude plugins install)
    local marketplace_name
    marketplace_name=$(get_marketplace_name)
    if [ -z "$marketplace_name" ]; then
        print_error "  Could not determine marketplace name from $MARKETPLACE_JSON"
        return 1
    fi
    if [ "$VERBOSE" = true ]; then
        print_dim "  Marketplace: $marketplace_name"
        echo ""
    fi

    # Pre-fetch installed plugin ids once — CLI install is idempotent and always reports
    # success, so we need our own check to produce honest "already installed" stats.
    local installed_list
    installed_list=$(get_installed_plugin_ids)

    # Counters
    local installed=0
    local already=0
    local errors=0
    local component_num=0

    # Process each component
    while IFS= read -r component; do
        ((component_num++))

        # Verify plugin is declared in marketplace.json (sanity check)
        if ! plugin_exists_in_marketplace "$component"; then
            print_error "  [$component_num/$total] Not declared in marketplace.json: $component"
            ((errors++))
            continue
        fi

        install_component "$component" "$marketplace_name" "$component_num" "$total" "$installed_list"
        case $? in
            0) ((installed++)) ;;
            2) ((already++)) ;;
            *) ((errors++)) ;;
        esac
    done <<< "$includes"

    # Summary
    echo ""
    print_header "======================================"
    print_header "  Summary"
    print_header "======================================"
    echo ""

    if [ "$DRY_RUN" = true ]; then
        print_info "  Would install:      $installed components"
        print_warning "  Already installed:  $already"
    else
        print_success "  Installed:          $installed"
        print_warning "  Already installed:  $already"
    fi

    if [ $errors -gt 0 ]; then
        print_error "  Errors:             $errors"
    fi

    echo ""

    if [ "$DRY_RUN" = true ]; then
        echo "Run without --dry-run to actually install."
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
BUNDLE_NAME=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --list|-l)
            check_dependencies
            list_bundles
            exit 0
            ;;
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
            BUNDLE_NAME="$1"
            shift
            ;;
    esac
done

# Main logic
if [ -z "$BUNDLE_NAME" ]; then
    show_help
    exit 0
fi

check_dependencies
install_bundle "$BUNDLE_NAME"
exit $?
