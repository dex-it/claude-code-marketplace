#!/usr/bin/env bash
# Команда-скилл, выпавшая из обоих обходов, не судится никем и видна только по счётчику в Summary.
set -uo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT

mk() { # <имя плагина> <имя скилла> <тело>
  local p="$tmp/plugins/skills/$1"
  mkdir -p "$p/.claude-plugin" "$p/skills/$2"
  printf '{"name":"%s","version":"1.0.0"}\n' "$1" > "$p/.claude-plugin/plugin.json"
  printf -- '---\nname: %s\ndescription: фикстура обхода\n---\n\n%s\n' "$2" "$3" > "$p/skills/$2/SKILL.md"
}
mk dex-skill-subagent-dispatch do '# /do

**Goal:** фикстура.'
mk dex-skill-other do '# Other'

cmd=$(MARKETPLACE_ROOT="$tmp" node "$root/tools/validate-command.js" all 2>&1)
skl=$(MARKETPLACE_ROOT="$tmp" node "$root/tools/validate-skill.js" all 2>&1)
one=$(MARKETPLACE_ROOT="$tmp" node "$root/tools/validate-skill.js" \
  "$tmp/plugins/skills/dex-skill-subagent-dispatch/skills/do/SKILL.md" 2>&1); one_rc=$?

fail=0
ok()  { echo "ok   $1"; }
bad() { echo "FAIL $1: $2"; fail=1; }

if printf '%s' "$cmd" | grep -q '1 command(s) checked'; then ok "validate-command подхватывает команду-скилл"
else bad "validate-command подхватывает команду-скилл" "$cmd"; fi

if printf '%s' "$cmd" | grep -q 'dex-skill-other'; then bad "validate-command не берёт одноимённый скилл чужого плагина" "$cmd"
else ok "validate-command не берёт одноимённый скилл чужого плагина"; fi

if printf '%s' "$skl" | grep -q 'dex-skill-subagent-dispatch'; then bad "validate-skill пропускает команду-скилл" "$skl"
else ok "validate-skill пропускает команду-скилл"; fi

if printf '%s' "$skl" | grep -q '1 skill(s) checked'; then ok "validate-skill судит одноимённый скилл чужого плагина"
else bad "validate-skill судит одноимённый скилл чужого плагина" "$skl"; fi

if [ $one_rc -ne 0 ] && printf '%s' "$one" | grep -q 'validate-command.js'; then ok "validate-skill на одном файле отсылает к validate-command"
else bad "validate-skill на одном файле отсылает к validate-command" "rc=$one_rc $one"; fi

exit $fail
