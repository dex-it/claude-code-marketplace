#!/bin/bash
# =============================================================================
# Discord Cancel - Cancels queued Discord notifications
# Part of dex-discord-notifier plugin
#
# Called on PreToolUse/UserPromptSubmit to cancel pending notifications
# while the user is still active.
# =============================================================================

set +e

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)

[ -z "$SESSION_ID" ] && exit 0

NOTIFY_DIR="/tmp/claude-discord-notifier"
[ -d "$NOTIFY_DIR" ] || exit 0

rm -f "${NOTIFY_DIR}/notify_${SESSION_ID}_"*.json 2>/dev/null

exit 0
