#!/bin/bash
# =============================================================================
# Discord Cancel - Cancels queued Discord notifications
# Part of dex-discord-notifier plugin
#
# Called on UserPromptSubmit to cancel pending notifications
# =============================================================================

set +e

QUEUE_DIR="/tmp/discord-notify-queue"
TIMER_PID_FILE="/tmp/discord-notify-timer.pid"

# Kill the timer process if running
if [ -f "$TIMER_PID_FILE" ]; then
    TIMER_PID=$(cat "$TIMER_PID_FILE" 2>/dev/null)
    if [ -n "$TIMER_PID" ] && kill -0 "$TIMER_PID" 2>/dev/null; then
        kill "$TIMER_PID" 2>/dev/null
        wait "$TIMER_PID" 2>/dev/null
    fi
    rm -f "$TIMER_PID_FILE"
fi

# Clear the queue
rm -rf "$QUEUE_DIR"

exit 0
