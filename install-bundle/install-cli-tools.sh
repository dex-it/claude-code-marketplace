#!/bin/bash

# CLI Tools Installer for Claude Code Marketplace
# Installs underlying CLI binaries used by dex-*-cli plugins.
# Auto-detects OS and package manager. Idempotent.
#
# Supported tools: gh, glab, kubectl, psql, redis-cli, kaf, rabbitmqadmin, aws, jenkins-cli, teamcity,
#                  netcoredbg, gdb, lldb, strace, bpftrace, bcc, perf, binutils, rizin, ilspycmd,
#                  flamegraph, valgrind, lief, dotnet-diagnostic-tools
# Meta-target:     runtime-diagnostics-tools (expands to all runtime-diagnostics CLI binaries)
# Supported OS:    Linux (apt/dnf/pacman/apk), macOS (brew)
# See docs/CLI_UTILITIES.md for the install matrix and per-tool notes.

set -eu

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
SUPPORTED_TOOLS=(gh glab kubectl psql redis-cli kaf rabbitmqadmin aws jenkins-cli teamcity \
                 netcoredbg gdb lldb strace bpftrace bcc perf binutils rizin ilspycmd \
                 flamegraph valgrind lief dotnet-diagnostic-tools)

# Meta-targets — expand to a list of individual tools before validation
RUNTIME_DIAG_TOOLS=(netcoredbg gdb lldb strace bpftrace bcc perf binutils rizin ilspycmd \
                    flamegraph valgrind lief dotnet-diagnostic-tools)

# Flags
DRY_RUN=false
VERBOSE=false
CHECK_ONLY=false
INSTALL_ALL=false
UPDATE=false

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
    echo "  --update, -u     Update already-installed tools (skip 'Already installed' early-return)"
    echo "  --dry-run, -n    Show what would be installed without installing"
    echo "  --verbose, -v    Show detailed output"
    echo "  --help, -h       Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --check                   # See what is missing"
    echo "  $0 --all                     # Install everything missing"
    echo "  $0 psql redis-cli kaf        # Install specific tools"
    echo "  $0 --all --dry-run           # Preview"
    echo "  $0 --update gh kubectl       # Update specific tools to latest"
    echo "  $0 --update --all            # Update all installed tools"
    echo ""
    echo "Supported tools: ${SUPPORTED_TOOLS[*]}"
    echo ""
    echo "Meta-targets:"
    echo "  runtime-diagnostics-tools   All runtime-diagnostics utilities (netcoredbg, gdb, lldb, etc)"
    echo ""
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
        jenkins-cli)   echo "Jenkins CLI (.jar + Java wrapper) (used by dex-jenkins-cli)" ;;
        teamcity)      echo "TeamCity CLI by JetBrains (used by dex-teamcity-cli)" ;;
        netcoredbg)    echo "Samsung netcoredbg .NET CLI debugger (used by dex-netcoredbg-cli)" ;;
        gdb)           echo "GNU debugger (native debug)" ;;
        lldb)          echo "LLVM debugger (native debug, macOS default)" ;;
        strace)        echo "Linux syscall tracer (Linux-only)" ;;
        bpftrace)      echo "eBPF high-level tracing language (Linux-only)" ;;
        bcc)           echo "BPF Compiler Collection tools: execsnoop, opensnoop, funclatency, memleak (Linux-only)" ;;
        perf)          echo "Linux perf events sampler (Linux-only)" ;;
        binutils)      echo "GNU binary utilities: readelf, nm, objdump, addr2line, strings, c++filt" ;;
        rizin)         echo "Rizin reverse-engineering framework with JSON output (cmd j)" ;;
        ilspycmd)      echo "ICSharpCode ILSpy CLI .NET decompiler (dotnet global tool)" ;;
        flamegraph)    echo "Brendan Gregg's flamegraph.pl + stackcollapse-perf.pl" ;;
        valgrind)      echo "Memory checker and race detector (Linux full; macOS x86_64 up to Ventura)" ;;
        lief)          echo "Python ELF/PE/Mach-O parsing library (pip install lief)" ;;
        dotnet-diagnostic-tools) echo "Meta: dotnet-dump, dotnet-trace, dotnet-counters, dotnet-gcdump, dotnet-stack, dotnet-symbol" ;;
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

# Write the jenkins-cli wrapper script. Defined as an exported function so recipes can call it
# via a single-line `_install_jenkins_cli_wrapper <target> <jar_default>` — recipe lines are
# executed via `bash -c "$line"` line-by-line, which would split a multi-line `tee <<EOF ... EOF`
# heredoc across separate invocations and silently produce an empty wrapper file.
# `#!/bin/sh` + POSIX-only constructs (${VAR:?msg}, exec) → portable across Alpine/Linux/macOS.
_install_jenkins_cli_wrapper() {
    local target="$1"
    local jar_default="$2"
    local _writer="tee"
    local _chmodder="chmod"
    case "$target" in
        /usr/local/*|/usr/bin/*|/usr/sbin/*) _writer="sudo tee"; _chmodder="sudo chmod" ;;
    esac
    $_writer "$target" >/dev/null <<EOFWRAPPER
#!/bin/sh
: "\${JENKINS_URL:?set JENKINS_URL}" "\${JENKINS_USER_ID:?set JENKINS_USER_ID}" "\${JENKINS_API_TOKEN:?set JENKINS_API_TOKEN}"
exec java -jar "\${JENKINS_CLI_JAR:-${jar_default}}" -s "\${JENKINS_URL%/}" -auth "\${JENKINS_USER_ID}:\${JENKINS_API_TOKEN}" "\$@"
EOFWRAPPER
    $_chmodder +x "$target"
}
export -f _install_jenkins_cli_wrapper

# Get currently installed version of a tool (one line, or empty)
tool_version() {
    local tool="$1"
    # Special-case: bcc / flamegraph / dotnet-diagnostic-tools / lief / binutils have no single binary
    # named after the tool — check via probe-binary or pip module instead of generic `command -v "$tool"`.
    case "$tool" in
        bcc)
            if command -v execsnoop-bpfcc >/dev/null 2>&1 || command -v execsnoop >/dev/null 2>&1; then
                echo "bcc-tools (execsnoop in PATH)"
            else
                echo ""
            fi
            return ;;
        flamegraph)
            if command -v flamegraph.pl >/dev/null 2>&1 || [ -x /usr/local/share/flamegraph/flamegraph.pl ]; then
                echo "flamegraph.pl (in PATH or /usr/local/share/flamegraph)"
            else
                echo ""
            fi
            return ;;
        binutils)
            if command -v readelf >/dev/null 2>&1 && command -v addr2line >/dev/null 2>&1; then
                readelf --version 2>/dev/null | head -1
            else
                echo ""
            fi
            return ;;
        lief)
            if python3 -c 'import lief; print(lief.__version__)' 2>/dev/null; then
                :
            else
                echo ""
            fi
            return ;;
        dotnet-diagnostic-tools)
            if command -v dotnet-dump >/dev/null 2>&1 && command -v dotnet-trace >/dev/null 2>&1 \
               && command -v dotnet-counters >/dev/null 2>&1 && command -v dotnet-gcdump >/dev/null 2>&1 \
               && command -v dotnet-stack >/dev/null 2>&1 && command -v dotnet-symbol >/dev/null 2>&1; then
                echo "dotnet diagnostic tools (all 6 in PATH)"
            else
                echo ""
            fi
            return ;;
    esac
    if ! command -v "$tool" >/dev/null 2>&1; then
        echo ""
        return
    fi
    case "$tool" in
        gh)            gh --version 2>/dev/null | head -1 ;;
        glab)          glab --version 2>/dev/null | head -1 ;;
        kubectl)       kubectl version --client 2>/dev/null | head -1 ;;
        psql)          psql --version 2>/dev/null | head -1 ;;
        redis-cli)     redis-cli --version 2>/dev/null | head -1 ;;
        kaf)           kaf --version 2>/dev/null | head -1 ;;
        rabbitmqadmin) rabbitmqadmin --version 2>/dev/null | head -1 ;;
        aws)           aws --version 2>/dev/null | head -1 ;;
        # jenkins-cli wrapper requires JENKINS_URL/USER_ID/TOKEN to even print version,
        # so we report status (not version) when the wrapper file is in PATH.
        jenkins-cli)   echo "jenkins-cli (wrapper installed; version requires JENKINS_URL)" ;;
        teamcity)      teamcity --version 2>/dev/null | head -1 ;;
        netcoredbg)    netcoredbg --version 2>/dev/null | head -1 ;;
        gdb)           gdb --version 2>/dev/null | head -1 ;;
        lldb)          lldb --version 2>/dev/null | head -1 ;;
        strace)        strace --version 2>/dev/null | head -1 ;;
        bpftrace)      bpftrace --version 2>/dev/null | head -1 ;;
        perf)          perf --version 2>/dev/null | head -1 ;;
        rizin)         rizin -v 2>/dev/null | head -1 ;;
        ilspycmd)      ilspycmd --version 2>/dev/null | head -1 ;;
        valgrind)      valgrind --version 2>/dev/null | head -1 ;;
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
            echo 'ARCH=$(uname -m); case "$ARCH" in x86_64) ARCH=amd64 ;; aarch64|arm64) ARCH=arm64 ;; esac; KVER=$(curl -fsSL https://dl.k8s.io/release/stable.txt) && curl -fsSL -o /tmp/kubectl "https://dl.k8s.io/release/${KVER}/bin/linux/${ARCH}/kubectl"'
            echo "sudo install -o root -g root -m 0755 /tmp/kubectl /usr/local/bin/kubectl"
            ;;
        linux:dnf:kubectl)
            echo 'ARCH=$(uname -m); case "$ARCH" in x86_64) ARCH=amd64 ;; aarch64|arm64) ARCH=arm64 ;; esac; KVER=$(curl -fsSL https://dl.k8s.io/release/stable.txt) && curl -fsSL -o /tmp/kubectl "https://dl.k8s.io/release/${KVER}/bin/linux/${ARCH}/kubectl"'
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
        # Release artifacts are named: rabbitmqadmin-<version>-<arch>-unknown-linux-gnu
        # We resolve the latest tag via the GitHub API and pick the matching arch.
        linux:*:rabbitmqadmin)
            echo 'ARCH=$(uname -m); case "$ARCH" in x86_64) ARCH=x86_64 ;; aarch64|arm64) ARCH=aarch64 ;; esac; VER=$(curl -fsSL https://api.github.com/repos/rabbitmq/rabbitmqadmin-ng/releases/latest | grep "\"tag_name\":" | head -1 | cut -d"\"" -f4 | sed "s/^v//") && curl -fsSL -o /tmp/rabbitmqadmin "https://github.com/rabbitmq/rabbitmqadmin-ng/releases/download/v${VER}/rabbitmqadmin-${VER}-${ARCH}-unknown-linux-gnu"'
            echo "sudo install -m 0755 /tmp/rabbitmqadmin /usr/local/bin/rabbitmqadmin"
            ;;
        macos:brew:rabbitmqadmin)
            echo "brew tap rabbitmq/tap && brew install rabbitmqadmin"
            ;;

        # jenkins-cli (Java + jar from Jenkins server, wrapper in /usr/local/bin)
        # Requires JENKINS_URL env to be set so we can download the jar via /jnlpJars/jenkins-cli.jar.
        linux:apt:jenkins-cli)
            echo "sudo apt update && sudo apt install -y default-jre curl"
            echo 'if [ -z "${JENKINS_URL:-}" ]; then echo "ERROR: set JENKINS_URL env before installing jenkins-cli (so the jar can be fetched from your Jenkins)" >&2; exit 1; fi'
            echo 'sudo mkdir -p /usr/local/lib && sudo curl -fsSL -o /usr/local/lib/jenkins-cli.jar "${JENKINS_URL%/}/jnlpJars/jenkins-cli.jar"'
            echo "_install_jenkins_cli_wrapper /usr/local/bin/jenkins-cli /usr/local/lib/jenkins-cli.jar"
            ;;
        linux:dnf:jenkins-cli)
            echo "sudo dnf install -y java-21-openjdk-headless curl"
            echo 'if [ -z "${JENKINS_URL:-}" ]; then echo "ERROR: set JENKINS_URL env before installing jenkins-cli" >&2; exit 1; fi'
            echo 'sudo mkdir -p /usr/local/lib && sudo curl -fsSL -o /usr/local/lib/jenkins-cli.jar "${JENKINS_URL%/}/jnlpJars/jenkins-cli.jar"'
            echo "_install_jenkins_cli_wrapper /usr/local/bin/jenkins-cli /usr/local/lib/jenkins-cli.jar"
            ;;
        linux:pacman:jenkins-cli)
            echo "sudo pacman -S --noconfirm jre-openjdk-headless curl"
            echo 'if [ -z "${JENKINS_URL:-}" ]; then echo "ERROR: set JENKINS_URL env before installing jenkins-cli" >&2; exit 1; fi'
            echo 'sudo mkdir -p /usr/local/lib && sudo curl -fsSL -o /usr/local/lib/jenkins-cli.jar "${JENKINS_URL%/}/jnlpJars/jenkins-cli.jar"'
            echo "_install_jenkins_cli_wrapper /usr/local/bin/jenkins-cli /usr/local/lib/jenkins-cli.jar"
            ;;
        linux:apk:jenkins-cli)
            echo "sudo apk add --no-cache openjdk21-jre-headless curl"
            echo 'if [ -z "${JENKINS_URL:-}" ]; then echo "ERROR: set JENKINS_URL env before installing jenkins-cli" >&2; exit 1; fi'
            echo 'sudo mkdir -p /usr/local/lib && sudo curl -fsSL -o /usr/local/lib/jenkins-cli.jar "${JENKINS_URL%/}/jnlpJars/jenkins-cli.jar"'
            echo "_install_jenkins_cli_wrapper /usr/local/bin/jenkins-cli /usr/local/lib/jenkins-cli.jar"
            ;;
        macos:brew:jenkins-cli)
            echo "brew install openjdk && brew link --force openjdk"
            echo 'if [ -z "${JENKINS_URL:-}" ]; then echo "ERROR: set JENKINS_URL env before installing jenkins-cli" >&2; exit 1; fi'
            echo 'mkdir -p "$HOME/.local/lib" && curl -fsSL -o "$HOME/.local/lib/jenkins-cli.jar" "${JENKINS_URL%/}/jnlpJars/jenkins-cli.jar"'
            echo 'mkdir -p "$HOME/.local/bin"'
            echo '_install_jenkins_cli_wrapper "$HOME/.local/bin/jenkins-cli" "$HOME/.local/lib/jenkins-cli.jar"'
            ;;

        # teamcity (JetBrains Go CLI)
        linux:*:teamcity)
            echo "curl -fsSL https://jb.gg/tc/install | bash"
            ;;
        macos:brew:teamcity)
            echo "brew install jetbrains/utils/teamcity"
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

        # netcoredbg (Samsung) — GitHub release multi-arch, latest tag via API.
        # Artifacts (на 2026-05): netcoredbg-{linux-amd64,linux-arm64,osx-amd64,win64}.{tar.gz,zip}.
        # macOS arm64 (Apple Silicon) официальной сборки нет — Rosetta или build from source.
        linux:*:netcoredbg)
            echo 'ARCH=$(uname -m); case "$ARCH" in x86_64) NCDBG_ARCH=amd64 ;; aarch64|arm64) NCDBG_ARCH=arm64 ;; *) echo "ERROR: unsupported arch for netcoredbg: $ARCH (supported: x86_64, aarch64/arm64)" >&2; exit 1 ;; esac; VER=$(curl -fsSL https://api.github.com/repos/Samsung/netcoredbg/releases/latest | grep "\"tag_name\":" | head -1 | cut -d"\"" -f4) && curl -fsSL -o /tmp/netcoredbg.tar.gz "https://github.com/Samsung/netcoredbg/releases/download/${VER}/netcoredbg-linux-${NCDBG_ARCH}.tar.gz"'
            echo "sudo mkdir -p /usr/local/lib/netcoredbg && sudo tar -xzf /tmp/netcoredbg.tar.gz -C /usr/local/lib/netcoredbg --strip-components=1"
            echo "sudo ln -sf /usr/local/lib/netcoredbg/netcoredbg /usr/local/bin/netcoredbg"
            ;;
        macos:*:netcoredbg)
            echo 'ARCH=$(uname -m); if [ "$ARCH" = "arm64" ]; then echo "ERROR: Samsung netcoredbg не публикует osx-arm64 артефакт. Варианты: запустить под Rosetta (arch -x86_64 netcoredbg) после установки x86_64 версии, либо собрать из исходников (https://github.com/Samsung/netcoredbg#build-process)" >&2; exit 1; fi'
            echo 'VER=$(curl -fsSL https://api.github.com/repos/Samsung/netcoredbg/releases/latest | grep "\"tag_name\":" | head -1 | cut -d"\"" -f4) && curl -fsSL -o /tmp/netcoredbg.tar.gz "https://github.com/Samsung/netcoredbg/releases/download/${VER}/netcoredbg-osx-amd64.tar.gz"'
            echo 'mkdir -p "$HOME/.local/lib/netcoredbg" && tar -xzf /tmp/netcoredbg.tar.gz -C "$HOME/.local/lib/netcoredbg" --strip-components=1'
            echo 'mkdir -p "$HOME/.local/bin" && ln -sf "$HOME/.local/lib/netcoredbg/netcoredbg" "$HOME/.local/bin/netcoredbg"'
            ;;

        # gdb
        linux:apt:gdb)     echo "sudo apt update && sudo apt install -y gdb" ;;
        linux:dnf:gdb)     echo "sudo dnf install -y gdb" ;;
        linux:pacman:gdb)  echo "sudo pacman -S --noconfirm gdb" ;;
        linux:apk:gdb)     echo "sudo apk add --no-cache gdb" ;;
        macos:brew:gdb)
            echo "brew install gdb"
            echo 'echo "On macOS gdb requires code-signing for ptrace. See https://sourceware.org/gdb/wiki/PermissionsDarwin for setup." >&2'
            ;;

        # lldb
        linux:apt:lldb)    echo "sudo apt update && sudo apt install -y lldb" ;;
        linux:dnf:lldb)    echo "sudo dnf install -y lldb" ;;
        linux:pacman:lldb) echo "sudo pacman -S --noconfirm lldb" ;;
        linux:apk:lldb)    echo "sudo apk add --no-cache lldb" ;;
        macos:brew:lldb)
            echo 'echo "lldb is preinstalled with Xcode Command Line Tools (xcode-select --install). brew install llvm provides a newer version if needed." >&2'
            echo 'if ! command -v lldb >/dev/null 2>&1; then brew install llvm && echo "Add $(brew --prefix llvm)/bin to PATH for lldb"; fi'
            ;;

        # strace (Linux-only)
        linux:apt:strace)    echo "sudo apt update && sudo apt install -y strace" ;;
        linux:dnf:strace)    echo "sudo dnf install -y strace" ;;
        linux:pacman:strace) echo "sudo pacman -S --noconfirm strace" ;;
        linux:apk:strace)    echo "sudo apk add --no-cache strace" ;;

        # bpftrace (Linux-only)
        linux:apt:bpftrace)    echo "sudo apt update && sudo apt install -y bpftrace" ;;
        linux:dnf:bpftrace)    echo "sudo dnf install -y bpftrace" ;;
        linux:pacman:bpftrace) echo "sudo pacman -S --noconfirm bpftrace" ;;
        linux:apk:bpftrace)    echo "sudo apk add --no-cache bpftrace" ;;

        # bcc-tools (Linux-only). Package name differs across distros:
        # apt → bpfcc-tools (tools available as <name>-bpfcc, e.g. execsnoop-bpfcc)
        # dnf/pacman → bcc-tools / bcc
        # Requires kernel headers OR BTF (kernel 5.x+ with CONFIG_DEBUG_INFO_BTF)
        linux:apt:bcc)
            echo "sudo apt update && sudo apt install -y bpfcc-tools linux-headers-\$(uname -r) || sudo apt install -y bpfcc-tools"
            ;;
        linux:dnf:bcc)    echo "sudo dnf install -y bcc-tools kernel-devel" ;;
        linux:pacman:bcc) echo "sudo pacman -S --noconfirm bcc bcc-tools" ;;
        linux:apk:bcc)    echo "sudo apk add --no-cache bcc-tools bcc-doc" ;;

        # perf (Linux-only). On Ubuntu/Debian package is linux-tools-<kernel>; fall back to generic.
        linux:apt:perf)
            echo "sudo apt update && (sudo apt install -y linux-tools-\$(uname -r) || sudo apt install -y linux-tools-generic linux-tools-common)"
            ;;
        linux:dnf:perf)    echo "sudo dnf install -y perf" ;;
        linux:pacman:perf) echo "sudo pacman -S --noconfirm perf" ;;
        linux:apk:perf)    echo "sudo apk add --no-cache perf" ;;

        # binutils
        linux:apt:binutils)    echo "sudo apt update && sudo apt install -y binutils" ;;
        linux:dnf:binutils)    echo "sudo dnf install -y binutils" ;;
        linux:pacman:binutils) echo "sudo pacman -S --noconfirm binutils" ;;
        linux:apk:binutils)    echo "sudo apk add --no-cache binutils" ;;
        macos:brew:binutils)
            echo "brew install binutils"
            echo 'echo "binutils on macOS is keg-only; gobjdump/greadelf/gnm available with g- prefix or via $(brew --prefix binutils)/bin in PATH" >&2'
            ;;

        # rizin (reverse-engineering framework)
        linux:apt:rizin)
            echo 'if apt-cache show rizin >/dev/null 2>&1; then sudo apt update && sudo apt install -y rizin; else curl -fsSL "https://github.com/rizinorg/rizin/releases/latest/download/rizin_\$(curl -fsSL https://api.github.com/repos/rizinorg/rizin/releases/latest | grep tag_name | head -1 | cut -d\\\" -f4 | sed s/^v//)_amd64.deb" -o /tmp/rizin.deb && sudo dpkg -i /tmp/rizin.deb; fi'
            ;;
        linux:dnf:rizin)    echo "sudo dnf install -y rizin" ;;
        linux:pacman:rizin) echo "sudo pacman -S --noconfirm rizin" ;;
        linux:apk:rizin)    echo "sudo apk add --no-cache rizin" ;;
        macos:brew:rizin)   echo "brew install rizin" ;;

        # ilspycmd (cross-platform dotnet global tool)
        linux:*:ilspycmd|macos:*:ilspycmd)
            echo 'command -v dotnet >/dev/null 2>&1 || { echo "ERROR: dotnet SDK >= 6.0 required for ilspycmd. Install from https://dotnet.microsoft.com/download" >&2; exit 1; }'
            echo "dotnet tool install --global ilspycmd || dotnet tool update --global ilspycmd"
            ;;

        # flamegraph (Brendan Gregg). Linux: git clone + symlinks; macOS: brew formula or git clone.
        linux:*:flamegraph)
            echo "sudo git clone --depth 1 https://github.com/brendangregg/FlameGraph.git /usr/local/share/flamegraph || (cd /usr/local/share/flamegraph && sudo git pull --ff-only)"
            echo "sudo ln -sf /usr/local/share/flamegraph/flamegraph.pl /usr/local/bin/flamegraph.pl"
            echo "sudo ln -sf /usr/local/share/flamegraph/stackcollapse-perf.pl /usr/local/bin/stackcollapse-perf.pl"
            echo "sudo ln -sf /usr/local/share/flamegraph/difffolded.pl /usr/local/bin/difffolded.pl"
            ;;
        macos:brew:flamegraph)
            echo 'if brew info flamegraph >/dev/null 2>&1; then brew install flamegraph; else git clone --depth 1 https://github.com/brendangregg/FlameGraph.git "$HOME/.local/share/flamegraph" && mkdir -p "$HOME/.local/bin" && ln -sf "$HOME/.local/share/flamegraph/flamegraph.pl" "$HOME/.local/bin/flamegraph.pl" && ln -sf "$HOME/.local/share/flamegraph/stackcollapse-perf.pl" "$HOME/.local/bin/stackcollapse-perf.pl"; fi'
            ;;

        # valgrind (Linux full; macOS x86_64 up to Ventura; Apple Silicon unsupported)
        linux:apt:valgrind)    echo "sudo apt update && sudo apt install -y valgrind" ;;
        linux:dnf:valgrind)    echo "sudo dnf install -y valgrind" ;;
        linux:pacman:valgrind) echo "sudo pacman -S --noconfirm valgrind" ;;
        linux:apk:valgrind)    echo "sudo apk add --no-cache valgrind" ;;
        macos:brew:valgrind)
            echo 'ARCH=$(uname -m); if [ "$ARCH" = "arm64" ]; then echo "ERROR: valgrind is not supported on Apple Silicon (arm64). Use leaks (preinstalled) or AddressSanitizer instead." >&2; exit 1; fi'
            echo "brew tap LouisBrunner/valgrind && brew install --HEAD LouisBrunner/valgrind/valgrind"
            ;;

        # LIEF (Python library; pip --user for non-root installs)
        linux:*:lief|macos:*:lief)
            echo 'command -v python3 >/dev/null 2>&1 || { echo "ERROR: Python 3.8+ required for LIEF" >&2; exit 1; }'
            echo "python3 -m pip install --user --upgrade lief"
            ;;

        # dotnet diagnostic tools (cross-platform meta: 6 dotnet global tools)
        linux:*:dotnet-diagnostic-tools|macos:*:dotnet-diagnostic-tools)
            echo 'command -v dotnet >/dev/null 2>&1 || { echo "ERROR: dotnet SDK >= 6.0 required. Install from https://dotnet.microsoft.com/download" >&2; exit 1; }'
            echo "for t in dotnet-dump dotnet-trace dotnet-counters dotnet-gcdump dotnet-stack dotnet-symbol; do dotnet tool install --global \"\$t\" 2>/dev/null || dotnet tool update --global \"\$t\"; done"
            ;;

        *)
            echo "__UNSUPPORTED__"
            ;;
    esac
}

# Transform install command to upgrade for PMs that don't auto-upgrade on install.
# apt/dnf/curl-based already upgrade on re-run; brew/apk/pacman/winget/scoop/choco need different commands.
# (PowerShell-side transformations live in install-cli-tools.ps1.)
to_upgrade() {
    local line="$1"
    [ "$UPDATE" != true ] && { echo "$line"; return; }
    # brew install <pkg> → brew upgrade <pkg> (does not match `brew tap`, `brew link`)
    line="${line//brew install /brew upgrade }"
    # apk add --no-cache <pkg> → apk upgrade --no-cache <pkg>
    line="${line//apk add --no-cache /apk upgrade --no-cache }"
    # pacman: replace `-S` with `-Syu` (full sync + system upgrade + ensure pkg installed).
    # ArchWiki considers `-Sy && -S` a partial upgrade and explicitly unsupported:
    # https://wiki.archlinux.org/title/System_maintenance#Partial_upgrades_are_unsupported
    # Trade-off: `-Syu` upgrades ALL system packages, not just the requested one. Unavoidable per Arch policy.
    # Match anchored at line start (with optional `sudo `) — protects against future recipes that might
    # emit `pacman -S` literal inside `echo`/comments without it being the actual installer command.
    if [[ "$line" == "pacman -S "* || "$line" == "sudo pacman -S "* ]] && [[ "$line" != *"pacman -Sy"* ]]; then
        line="${line//pacman -S /pacman -Syu }"
    fi
    echo "$line"
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
        line=$(to_upgrade "$line")
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

# Process one tool. Returns: 0 freshly installed/updated (or planned in dry-run), 2 already installed (no update),
# 3 would-update (--check + --update), 4 already-at-latest (--update + version unchanged), 1 error
process_tool() {
    local tool="$1" os="$2" pm="$3" idx="$4" total="$5"

    # Already installed?
    local ver
    ver=$(tool_version "$tool")
    if [ -n "$ver" ]; then
        if [ "$UPDATE" = true ]; then
            if [ "$CHECK_ONLY" = true ]; then
                print_info "  [$idx/$total] Would update: $tool ($ver)"
                return 3
            fi
            if [ "$DRY_RUN" = true ]; then
                print_info "  [$idx/$total] Would update: $tool (currently: $ver)"
            else
                print_info "  [$idx/$total] Updating: $tool (currently: $ver)"
            fi
            # fall through to run_recipe with UPDATE=true → to_upgrade transformation kicks in
        else
            print_warning "  [$idx/$total] Already installed: $tool"
            [ "$VERBOSE" = true ] && print_dim "           $ver"
            return 2
        fi
    else
        if [ "$CHECK_ONLY" = true ]; then
            print_info "  [$idx/$total] Missing: $tool — $(tool_description "$tool")"
            return 0
        fi

        if [ "$DRY_RUN" = true ]; then
            print_info "  [$idx/$total] Would install: $tool"
        else
            print_info "  [$idx/$total] Installing: $tool"
        fi
    fi

    if run_recipe "$tool" "$os" "$pm"; then
        if [ "$DRY_RUN" = false ]; then
            # Refresh shell command cache — package manager just put new binary in PATH
            hash -r 2>/dev/null || true
            local v
            v=$(tool_version "$tool")
            if [ -n "$v" ]; then
                if [ "$UPDATE" = true ] && [ -n "$ver" ]; then
                    # jenkins-cli's tool_version returns a constant string (the wrapper binary itself
                    # never exposes the JAR version without JENKINS_URL). Comparing strings would always
                    # report "Already at latest" even when the recipe re-downloaded the JAR — misleading.
                    # For jenkins-cli, treat any successful recipe run as Updated.
                    if [ "$tool" != "jenkins-cli" ] && [ "$v" = "$ver" ]; then
                        print_success "           Already at latest: $v"
                        return 4
                    else
                        print_success "           Updated: $v"
                    fi
                else
                    print_success "           Installed: $v"
                fi
                return 0
            else
                print_warning "           Recipe ran but $tool not found in PATH — restart shell or check installer output"
                return 1
            fi
        fi
        # DRY_RUN=true: differentiate would-update from would-install so summary stays honest.
        # An installed tool taking the update path returns 3 (would-update); a missing tool returns 0 (would-install).
        if [ "$UPDATE" = true ] && [ -n "$ver" ]; then
            return 3
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
        --update|-u)   UPDATE=true; shift ;;
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
    if [ "$UPDATE" = true ]; then
        print_error "--update requires tool names or --all"
        echo ""
        show_help
        exit 1
    fi
    show_help
    exit 0
fi

# Expand meta-targets (runtime-diagnostics-tools) into individual tool names.
# Done before validation so the meta-name itself doesn't have to be in SUPPORTED_TOOLS for the check loop.
expanded_tools=()
for t in "${TOOLS[@]}"; do
    case "$t" in
        runtime-diagnostics-tools)
            expanded_tools+=("${RUNTIME_DIAG_TOOLS[@]}")
            ;;
        *)
            expanded_tools+=("$t")
            ;;
    esac
done
TOOLS=("${expanded_tools[@]}")

# Validate explicit tool names
for t in "${TOOLS[@]}"; do
    found=false
    for s in "${SUPPORTED_TOOLS[@]}"; do
        [ "$t" = "$s" ] && { found=true; break; }
    done
    if [ "$found" = false ]; then
        print_error "Unsupported tool: $t"
        echo "Supported: ${SUPPORTED_TOOLS[*]}"
        echo "Meta-targets: runtime-diagnostics-tools"
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
    if [ "$UPDATE" = true ]; then
        print_header "  Checking CLI tools (update plan)"
    else
        print_header "  Checking CLI tools (no install)"
    fi
elif [ "$DRY_RUN" = true ]; then
    if [ "$UPDATE" = true ]; then
        print_header "  CLI tools update — dry run"
    else
        print_header "  CLI tools install — dry run"
    fi
elif [ "$UPDATE" = true ]; then
    print_header "  Updating CLI tools"
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
would_update=0
at_latest=0
total=${#TOOLS[@]}
idx=0
# Disable `set -e` for the main loop: process_tool intentionally returns non-zero codes
# (2 = already installed, 3 = would update, 4 = already at latest) for signaling, which
# `set -e` would otherwise treat as a hard failure and exit the script after the first tool.
# The case-block below classifies every code; unhandled codes fall through to `errors`.
set +e
for t in "${TOOLS[@]}"; do
    idx=$((idx + 1))
    process_tool "$t" "$OS" "$PM" "$idx" "$total"
    case $? in
        0) if [ "$CHECK_ONLY" = true ]; then missing=$((missing + 1)); else installed=$((installed + 1)); fi ;;
        2) already=$((already + 1)) ;;
        3) would_update=$((would_update + 1)) ;;
        4) at_latest=$((at_latest + 1)) ;;
        *) errors=$((errors + 1)) ;;
    esac
done
set -e

# Summary
echo ""
print_header "================================================"
print_header "  Summary"
print_header "================================================"
echo ""

if [ "$CHECK_ONLY" = true ]; then
    if [ "$UPDATE" = true ]; then
        print_info    "  Would update:       $would_update"
        print_info    "  Would install:      $missing"
    else
        print_success "  Already installed:  $already"
        print_info    "  Missing:            $missing"
    fi
elif [ "$DRY_RUN" = true ]; then
    if [ "$UPDATE" = true ]; then
        print_info    "  Would update:       $would_update"
        print_info    "  Would install:      $installed"
    else
        print_info    "  Would install:      $installed"
        print_warning "  Already installed:  $already"
    fi
elif [ "$UPDATE" = true ]; then
    print_success "  Updated:            $installed"
    [ $at_latest -gt 0 ] && print_dim     "  Already at latest:  $at_latest"
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
