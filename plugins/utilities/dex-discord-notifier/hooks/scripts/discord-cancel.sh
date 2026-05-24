#!/bin/bash
# =============================================================================
# Discord Cancel - Cancels queued Discord notifications
# Part of dex-discord-notifier plugin
#
# Called on PreToolUse/UserPromptSubmit/PermissionDenied to cancel pending
# notifications while the user is still active.
# =============================================================================

set +e

# Session isolation: same derivation as discord-notify.sh — must match exactly.
# Uses $PWD so each project directory gets its own set of temp files,
# preventing interference between multiple Claude Code sessions.
SESSION_ID=$(printf '%s' "$PWD" | cksum | cut -d' ' -f1)

LATEST_FILE="/tmp/discord-notify-${SESSION_ID}-latest.json"
TIMER_PID_FILE="/tmp/discord-notify-${SESSION_ID}-timer.pid"
LOCK_FILE="/tmp/discord-notify-${SESSION_ID}-lock"

[ ! -f "$LATEST_FILE" ] && [ ! -f "$TIMER_PID_FILE" ] && exit 0

(
    flock 9
    if [ -f "$TIMER_PID_FILE" ]; then
        TIMER_PID=$(cat "$TIMER_PID_FILE" 2>/dev/null)
        if [ -n "$TIMER_PID" ] && kill -0 "$TIMER_PID" 2>/dev/null; then
            kill -- -"$TIMER_PID" 2>/dev/null  # Kill entire process group (setsid)
            kill "$TIMER_PID" 2>/dev/null       # Fallback for non-setsid path
        fi
        rm -f "$TIMER_PID_FILE"
    fi
    rm -f "$LATEST_FILE"

) 9>"$LOCK_FILE"

exit 0
