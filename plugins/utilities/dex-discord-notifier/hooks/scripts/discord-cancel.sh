#!/bin/bash
# =============================================================================
# Discord Cancel - Cancels queued Discord notifications
# Part of dex-discord-notifier plugin
#
# Called on UserPromptSubmit to cancel pending notifications
# =============================================================================

set +e

LATEST_FILE="/tmp/discord-notify-latest.json"
TIMER_PID_FILE="/tmp/discord-notify-timer.pid"
LOCK_FILE="/tmp/discord-notify-lock"

[ ! -f "$LATEST_FILE" ] && [ ! -f "$TIMER_PID_FILE" ] && exit 0

(
    flock 9
    if [ -f "$TIMER_PID_FILE" ]; then
        TIMER_PID=$(cat "$TIMER_PID_FILE" 2>/dev/null)
        if [ -n "$TIMER_PID" ] && kill -0 "$TIMER_PID" 2>/dev/null; then
            kill "$TIMER_PID" 2>/dev/null
        fi
        rm -f "$TIMER_PID_FILE"
    fi
    rm -f "$LATEST_FILE"
    rm -rf /tmp/discord-notify-queue 2>/dev/null
) 9>"$LOCK_FILE"

exit 0
