#!/bin/bash

# Bundle Installer for Claude Code Marketplace
# Automatically installs all components from a bundle's _bundle.includes[]
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
            if [ -f "$plugin_json" ]; then
                bundle_name=$(basename "$bundle_dir" | sed 's/^dex-bundle-//')
                description=$(jq -r '.description // "No description"' "$plugin_json")
                includes_count=$(jq -r '._bundle.includes | length' "$plugin_json")

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

# Get source path for a plugin from marketplace.json
get_plugin_source() {
    local plugin_name="$1"
    jq -r --arg name "$plugin_name" '.plugins[] | select(.name == $name) | .source // empty' "$MARKETPLACE_JSON"
}

# Install a single component
install_component() {
    local component_name="$1"
    local source_path="$2"
    local component_num="$3"
    local total="$4"

    if [ "$DRY_RUN" = true ]; then
        print_info "  [$component_num/$total] Would install: $component_name"
        if [ "$VERBOSE" = true ]; then
            print_dim "           Source: $source_path"
        fi
        return 0
    fi

    print_info "  [$component_num/$total] Installing: $component_name"
    if [ "$VERBOSE" = true ]; then
        print_dim "           Source: $source_path"
    fi

    # Run claude plugins install
    local output
    output=$(claude plugins install "$source_path" 2>&1)
    local exit_code=$?

    if [ $exit_code -eq 0 ]; then
        print_success "           Installed successfully"
        return 0
    else
        if echo "$output" | grep -qi "already installed\|exists"; then
            print_warning "           Already installed (skipped)"
        else
            print_warning "           Skipped: $output"
        fi
        return 1
    fi
}

# Install bundle
install_bundle() {
    local bundle_name="$1"
    local bundle_dir="$BUNDLES_DIR/dex-bundle-$bundle_name"
    local plugin_json="$bundle_dir/.claude-plugin/plugin.json"

    # Check if bundle exists
    if [ ! -d "$bundle_dir" ]; then
        print_error "Bundle not found: $bundle_name"
        echo ""
        echo "Available bundles:"
        list_bundles_short
        echo ""
        return 1
    fi

    if [ ! -f "$plugin_json" ]; then
        print_error "plugin.json not found in bundle: $bundle_name"
        return 1
    fi

    # Check marketplace.json exists
    if [ ! -f "$MARKETPLACE_JSON" ]; then
        print_error "marketplace.json not found: $MARKETPLACE_JSON"
        return 1
    fi

    # Get bundle info
    local description=$(jq -r '.description // "No description"' "$plugin_json")
    local includes=$(jq -r '._bundle.includes[]' "$plugin_json")
    local total=$(jq -r '._bundle.includes | length' "$plugin_json")

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

    # Counters
    local installed=0
    local skipped=0
    local errors=0
    local component_num=0

    # Process each component
    while IFS= read -r component; do
        ((component_num++))

        # Get source path from marketplace.json
        local source=$(get_plugin_source "$component")

        if [ -z "$source" ]; then
            print_error "  [$component_num/$total] Source not found for: $component"
            ((errors++))
            continue
        fi

        # Convert relative path to absolute
        local full_source="$PROJECT_ROOT/${source#./}"

        if install_component "$component" "$full_source" "$component_num" "$total"; then
            ((installed++))
        else
            ((skipped++))
        fi
    done <<< "$includes"

    # Summary
    echo ""
    print_header "======================================"
    print_header "  Summary"
    print_header "======================================"
    echo ""

    if [ "$DRY_RUN" = true ]; then
        print_info "  Would install: $installed components"
    else
        print_success "  Installed: $installed"
        print_warning "  Skipped:   $skipped"
    fi

    if [ $errors -gt 0 ]; then
        print_error "  Errors:    $errors"
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
