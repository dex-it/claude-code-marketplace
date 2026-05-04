#!/bin/bash

# CLI Tools Installer for Claude Code Marketplace
# Installs underlying CLI binaries used by dex-*-cli plugins.
# Auto-detects OS and package manager. Idempotent.
#
# Supported tools: gh, glab, kubectl, psql, redis-cli, kaf
# Supported OS:    Linux (apt/dnf/pacman/apk), macOS (brew)
# See docs/CLI_UTILITIES.md for the install matrix and per-tool notes.

set -u

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Supported tools
SUPPORTED_TOOLS=(gh glab kubectl psql redis-cli kaf rabbitmqadmin aws)

# Flags
DRY_RUN=false
VERBOSE=false
CHECK_ONLY=false
INSTALL_ALL=false

# Show help
show_help() {
    echo ""
    print_header "================================================"
    print_header "  CLI Tools Installer for Claude Code Marketplace"
    print_header "================================================"
    echo ""
    echo "Usage: $0 [OPTIONS] [TOOL...]"
    echo ""
    echo "Installs CLI binaries used by dex-*-cli plugins."
    echo ""
    echo "Options:"
    echo "  --list, -l       List supported tools"
    echo "  --check, -c      Check what is already installed (no install)"
    echo "  --all, -a        Install all supported tools"
    echo "  --dry-run, -n    Show what would be installed without installing"
    echo "  --verbose, -v    Show detailed output"
    echo "  --help, -h       Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --check                   # See what is missing"
    echo "  $0 --all                     # Install everything missing"
    echo "  $0 psql redis-cli kaf        # Install specific tools"
    echo "  $0 --all --dry-run           # Preview"
    echo ""
    echo "Supported tools: ${SUPPORTED_TOOLS[*]}"
    echo "See docs/CLI_UTILITIES.md for the full install matrix."
    echo ""
}

# List supported tools (short)
list_tools_short() {
    echo ""
    print_header "Supported tools"
    echo ""
    for t in "${SUPPORTED_TOOLS[@]}"; do
        printf "  - %-12s — %s\n" "$t" "$(tool_description "$t")"
    done
    echo ""
}

# Description for each tool
tool_description() {
    case "$1" in
        gh)            echo "GitHub CLI (used by dex-github-cli)" ;;
        glab)          echo "GitLab CLI (used by dex-gitlab-cli)" ;;
        kubectl)       echo "Kubernetes CLI (used by dex-kubectl-cli)" ;;
        psql)          echo "PostgreSQL client (used by dex-psql-cli)" ;;
        redis-cli)     echo "Redis client (used by dex-redis-cli)" ;;
        kaf)           echo "Kafka client by birdayz (used by dex-kaf-cli)" ;;
        rabbitmqadmin) echo "RabbitMQ HTTP API CLI (rabbitmqadmin-ng) (used by dex-rabbitmqadmin-cli)" ;;
        aws)           echo "AWS CLI v2 (used by dex-aws-s3-cli)" ;;
        *)             echo "(unknown)" ;;
    esac
}

# Detect OS: linux | macos | unsupported
detect_os() {
    case "$(uname -s)" in
        Linux*)  echo "linux" ;;
        Darwin*) echo "macos" ;;
        *)       echo "unsupported" ;;
    esac
}

# Detect package manager on Linux: apt | dnf | pacman | apk | none
detect_linux_pm() {
    if   command -v apt-get >/dev/null 2>&1; then echo "apt"
    elif command -v dnf      >/dev/null 2>&1; then echo "dnf"
    elif command -v pacman   >/dev/null 2>&1; then echo "pacman"
    elif command -v apk      >/dev/null 2>&1; then echo "apk"
    else echo "none"
    fi
}

# Get currently installed version of a tool (one line, or empty)
tool_version() {
    local tool="$1"
    if ! command -v "$tool" >/dev/null 2>&1; then
        echo ""
        return
    fi
    case "$tool" in
        gh)            gh --version 2>/dev/null | head -1 ;;
        glab)          glab --version 2>/dev/null | head -1 ;;
        kubectl)       kubectl version --client --short 2>/dev/null || kubectl version --client 2>/dev/null | head -1 ;;
        psql)          psql --version 2>/dev/null | head -1 ;;
        redis-cli)     redis-cli --version 2>/dev/null | head -1 ;;
        kaf)           kaf --version 2>/dev/null | head -1 ;;
        rabbitmqadmin) rabbitmqadmin --version 2>/dev/null | head -1 ;;
        aws)           aws --version 2>/dev/null | head -1 ;;
    esac
}

# Print install recipe (lines printed are the actual command(s) to run)
# Args: tool, os, pm
print_recipe() {
    local tool="$1" os="$2" pm="$3"
    case "$os:$pm:$tool" in
        # gh
        linux:apt:gh)
            echo "type -p curl >/dev/null || sudo apt install -y curl"
            echo 'curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg'
            echo 'sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg'
            echo 'echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list >/dev/null'
            echo "sudo apt update && sudo apt install -y gh"
            ;;
        linux:dnf:gh)
            echo "sudo dnf install -y 'dnf-command(config-manager)'"
            echo "sudo dnf config-manager --add-repo https://cli.github.com/packages/rpm/gh-cli.repo"
            echo "sudo dnf install -y gh"
            ;;
        linux:pacman:gh)
            echo "sudo pacman -S --noconfirm github-cli"
            ;;
        linux:apk:gh)
            echo "sudo apk add --no-cache github-cli"
            ;;
        macos:brew:gh)
            echo "brew install gh"
            ;;

        # glab
        linux:apt:glab)
            echo "curl -fsSL https://gitlab.com/gitlab-org/cli/-/raw/main/scripts/install.sh | sudo bash"
            ;;
        linux:dnf:glab)
            echo "sudo dnf install -y glab || curl -fsSL https://gitlab.com/gitlab-org/cli/-/raw/main/scripts/install.sh | sudo bash"
            ;;
        linux:pacman:glab)
            echo "sudo pacman -S --noconfirm glab"
            ;;
        linux:apk:glab)
            echo "sudo apk add --no-cache glab"
            ;;
        macos:brew:glab)
            echo "brew install glab"
            ;;

        # kubectl
        linux:apt:kubectl)
            echo 'curl -fsSL "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" -o /tmp/kubectl'
            echo "sudo install -o root -g root -m 0755 /tmp/kubectl /usr/local/bin/kubectl"
            ;;
        linux:dnf:kubectl)
            echo 'curl -fsSL "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" -o /tmp/kubectl'
            echo "sudo install -o root -g root -m 0755 /tmp/kubectl /usr/local/bin/kubectl"
            ;;
        linux:pacman:kubectl)
            echo "sudo pacman -S --noconfirm kubectl"
            ;;
        linux:apk:kubectl)
            echo "sudo apk add --no-cache kubectl"
            ;;
        macos:brew:kubectl)
            echo "brew install kubectl"
            ;;

        # psql
        linux:apt:psql)
            echo "sudo apt update && sudo apt install -y postgresql-client"
            ;;
        linux:dnf:psql)
            echo "sudo dnf install -y postgresql"
            ;;
        linux:pacman:psql)
            echo "sudo pacman -S --noconfirm postgresql-libs"
            ;;
        linux:apk:psql)
            echo "sudo apk add --no-cache postgresql-client"
            ;;
        macos:brew:psql)
            echo "brew install libpq && brew link --force libpq"
            ;;

        # redis-cli
        linux:apt:redis-cli)
            echo "sudo apt update && sudo apt install -y redis-tools"
            ;;
        linux:dnf:redis-cli)
            echo "sudo dnf install -y redis"
            ;;
        linux:pacman:redis-cli)
            echo "sudo pacman -S --noconfirm redis"
            ;;
        linux:apk:redis-cli)
            echo "sudo apk add --no-cache redis"
            ;;
        macos:brew:redis-cli)
            echo "brew install redis"
            ;;

        # kaf
        linux:*:kaf)
            echo 'curl -fsSL https://raw.githubusercontent.com/birdayz/kaf/master/godownloader.sh | BINDIR="$HOME/.local/bin" bash'
            ;;
        macos:brew:kaf)
            echo "brew tap birdayz/tap && brew install kaf"
            ;;

        # rabbitmqadmin (rabbitmqadmin-ng)
        linux:*:rabbitmqadmin)
            echo 'ARCH=$(uname -m); case "$ARCH" in x86_64) ARCH=x86_64 ;; aarch64|arm64) ARCH=aarch64 ;; esac; curl -fsSL -o /tmp/rabbitmqadmin "https://github.com/rabbitmq/rabbitmqadmin-ng/releases/latest/download/rabbitmqadmin-linux-${ARCH}"'
            echo "sudo install -m 0755 /tmp/rabbitmqadmin /usr/local/bin/rabbitmqadmin"
            ;;
        macos:brew:rabbitmqadmin)
            echo "brew tap rabbitmq/tap && brew install rabbitmqadmin"
            ;;

        # aws (AWS CLI v2)
        linux:apt:aws)
            echo "sudo apt update && sudo apt install -y unzip curl"
            echo 'ARCH=$(uname -m); case "$ARCH" in x86_64) URL=https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip ;; aarch64|arm64) URL=https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip ;; esac; curl -fsSL "$URL" -o /tmp/awscliv2.zip'
            echo "unzip -q -o /tmp/awscliv2.zip -d /tmp && sudo /tmp/aws/install --update"
            ;;
        linux:dnf:aws)
            echo "sudo dnf install -y unzip curl"
            echo 'ARCH=$(uname -m); case "$ARCH" in x86_64) URL=https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip ;; aarch64|arm64) URL=https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip ;; esac; curl -fsSL "$URL" -o /tmp/awscliv2.zip'
            echo "unzip -q -o /tmp/awscliv2.zip -d /tmp && sudo /tmp/aws/install --update"
            ;;
        linux:pacman:aws)
            echo "sudo pacman -S --noconfirm aws-cli-v2"
            ;;
        linux:apk:aws)
            echo "sudo apk add --no-cache aws-cli"
            ;;
        macos:brew:aws)
            echo "brew install awscli"
            ;;

        *)
            echo "__UNSUPPORTED__"
            ;;
    esac
}

# Run recipe (each line is a shell command). Echoes commands when verbose.
run_recipe() {
    local tool="$1" os="$2" pm="$3"
    local recipe
    recipe=$(print_recipe "$tool" "$os" "$pm")

    if [ "$recipe" = "__UNSUPPORTED__" ]; then
        print_error "  No recipe for $tool on $os/$pm — see docs/CLI_UTILITIES.md install matrix"
        return 1
    fi

    while IFS= read -r line; do
        [ -z "$line" ] && continue
        if [ "$DRY_RUN" = true ]; then
            print_dim "    \$ $line"
        else
            [ "$VERBOSE" = true ] && print_dim "    \$ $line"
            bash -c "$line"
            local rc=$?
            if [ $rc -ne 0 ]; then
                print_error "    Command failed (exit $rc): $line"
                return 1
            fi
        fi
    done <<< "$recipe"
    return 0
}

# Process one tool. Returns: 0 freshly installed (or planned in dry-run), 2 already installed, 1 error
process_tool() {
    local tool="$1" os="$2" pm="$3" idx="$4" total="$5"

    # Already installed?
    local ver
    ver=$(tool_version "$tool")
    if [ -n "$ver" ]; then
        print_warning "  [$idx/$total] Already installed: $tool"
        [ "$VERBOSE" = true ] && print_dim "           $ver"
        return 2
    fi

    if [ "$CHECK_ONLY" = true ]; then
        print_info "  [$idx/$total] Missing: $tool — $(tool_description "$tool")"
        return 0
    fi

    if [ "$DRY_RUN" = true ]; then
        print_info "  [$idx/$total] Would install: $tool"
    else
        print_info "  [$idx/$total] Installing: $tool"
    fi

    if run_recipe "$tool" "$os" "$pm"; then
        if [ "$DRY_RUN" = false ]; then
            local v
            v=$(tool_version "$tool")
            if [ -n "$v" ]; then
                print_success "           Installed: $v"
                return 0
            else
                print_warning "           Recipe ran but $tool not found in PATH — restart shell or check installer output"
                return 1
            fi
        fi
        return 0
    else
        return 1
    fi
}

# Pre-flight: check OS and package manager
preflight() {
    local os pm
    os=$(detect_os)
    if [ "$os" = "unsupported" ]; then
        print_error "Unsupported OS: $(uname -s). This script supports Linux and macOS."
        print_dim "On Windows, use install-cli-tools.ps1 instead."
        exit 1
    fi

    if [ "$os" = "linux" ]; then
        pm=$(detect_linux_pm)
        if [ "$pm" = "none" ]; then
            print_error "No supported package manager found (apt / dnf / pacman / apk)."
            print_dim "See docs/CLI_UTILITIES.md for manual install instructions."
            exit 1
        fi
    else
        pm="brew"
        if ! command -v brew >/dev/null 2>&1; then
            print_error "Homebrew not found. Install it first: https://brew.sh"
            exit 1
        fi
    fi

    echo "$os $pm"
}

# Parse args
TOOLS=()
while [[ $# -gt 0 ]]; do
    case "$1" in
        --list|-l)     ACTION=list; shift ;;
        --check|-c)    CHECK_ONLY=true; shift ;;
        --all|-a)      INSTALL_ALL=true; shift ;;
        --dry-run|-n)  DRY_RUN=true; shift ;;
        --verbose|-v)  VERBOSE=true; shift ;;
        --help|-h)     show_help; exit 0 ;;
        -*)            print_error "Unknown option: $1"; show_help; exit 1 ;;
        *)             TOOLS+=("$1"); shift ;;
    esac
done

# Action: list
if [ "${ACTION:-}" = "list" ]; then
    list_tools_short
    exit 0
fi

# Default: --check if no tools and not --all
if [ ${#TOOLS[@]} -eq 0 ] && [ "$INSTALL_ALL" = false ] && [ "$CHECK_ONLY" = false ]; then
    show_help
    exit 0
fi

# Validate explicit tool names
for t in "${TOOLS[@]}"; do
    found=false
    for s in "${SUPPORTED_TOOLS[@]}"; do
        [ "$t" = "$s" ] && { found=true; break; }
    done
    if [ "$found" = false ]; then
        print_error "Unsupported tool: $t"
        echo "Supported: ${SUPPORTED_TOOLS[*]}"
        exit 1
    fi
done

# --all expands TOOLS
if [ "$INSTALL_ALL" = true ]; then
    TOOLS=("${SUPPORTED_TOOLS[@]}")
fi

# --check with no tool list = check all
if [ "$CHECK_ONLY" = true ] && [ ${#TOOLS[@]} -eq 0 ]; then
    TOOLS=("${SUPPORTED_TOOLS[@]}")
fi

# Pre-flight
read -r OS PM < <(preflight)

# Banner
echo ""
print_header "================================================"
if [ "$CHECK_ONLY" = true ]; then
    print_header "  Checking CLI tools (no install)"
elif [ "$DRY_RUN" = true ]; then
    print_header "  CLI tools install — dry run"
else
    print_header "  Installing CLI tools"
fi
print_header "================================================"
echo ""
print_dim "  OS: $OS, package manager: $PM"
print_dim "  Tools: ${TOOLS[*]}"
echo ""

# Process each tool
installed=0
already=0
errors=0
missing=0
total=${#TOOLS[@]}
idx=0
for t in "${TOOLS[@]}"; do
    idx=$((idx + 1))
    process_tool "$t" "$OS" "$PM" "$idx" "$total"
    case $? in
        0) if [ "$CHECK_ONLY" = true ]; then missing=$((missing + 1)); else installed=$((installed + 1)); fi ;;
        2) already=$((already + 1)) ;;
        *) errors=$((errors + 1)) ;;
    esac
done

# Summary
echo ""
print_header "================================================"
print_header "  Summary"
print_header "================================================"
echo ""

if [ "$CHECK_ONLY" = true ]; then
    print_success "  Already installed:  $already"
    print_info    "  Missing:            $missing"
elif [ "$DRY_RUN" = true ]; then
    print_info    "  Would install:      $installed"
    print_warning "  Already installed:  $already"
else
    print_success "  Installed:          $installed"
    print_warning "  Already installed:  $already"
fi

[ $errors -gt 0 ] && print_error "  Errors:             $errors"
echo ""

if [ "$DRY_RUN" = true ]; then
    echo "Run without --dry-run to actually install."
    echo ""
fi

[ $errors -gt 0 ] && exit 1
exit 0
