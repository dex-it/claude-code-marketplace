#!/bin/bash
# =============================================================================
# Telegram Cancel - Cancels pending delayed notifications
# Part of dex-telegram-notifier plugin
#
# Called on UserPromptSubmit event to cancel notifications that are waiting
# to be sent. This prevents notifications when user responds before delay.
# =============================================================================

# Exit silently on errors - never block Claude
set +e

# State directory for pending notifications
STATE_DIR="${HOME}/.claude/telegram-notifier"

# If state directory doesn't exist, nothing to cancel
[ ! -d "$STATE_DIR" ] && exit 0

# Remove all pending notification files
rm -f "$STATE_DIR"/pending_*.json 2>/dev/null

exit 0
