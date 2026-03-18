#!/bin/bash
# =============================================================================
# Telegram Notifier for Claude Code
# Part of dex-telegram-notifier plugin
#
# Sends notifications to Telegram when Claude Code events occur:
# - Stop: Claude finished working
# - Notification: Claude is waiting for user input
# - SubagentStop: A subagent completed its task
#
# Configuration via environment variables (see README.md)
# =============================================================================

# Exit silently on errors - never block Claude
set +e

# =============================================================================
# Configuration from Environment Variables
# =============================================================================

# Required
BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
CHAT_ID="${TELEGRAM_CHAT_ID:-}"

# Optional settings with defaults
MSG_LIMIT="${TELEGRAM_MESSAGE_LIMIT:-4000}"
LANG="${TELEGRAM_LANGUAGE:-ru}"
THREAD_ID="${TELEGRAM_THREAD_ID:-}"

# Feature toggles (all enabled by default)
NOTIFY_STOP="${TELEGRAM_NOTIFY_STOP:-true}"
NOTIFY_WAITING="${TELEGRAM_NOTIFY_WAITING:-true}"
NOTIFY_SUBAGENT="${TELEGRAM_NOTIFY_SUBAGENT:-true}"
INCLUDE_THINKING="${TELEGRAM_INCLUDE_THINKING:-false}"
INCLUDE_TOOLS="${TELEGRAM_INCLUDE_TOOLS:-true}"
INCLUDE_TODO="${TELEGRAM_INCLUDE_TODO:-true}"
INCLUDE_PLAN="${TELEGRAM_INCLUDE_PLAN:-true}"
INCLUDE_MESSAGE="${TELEGRAM_INCLUDE_MESSAGE:-true}"
INCLUDE_QUESTIONS="${TELEGRAM_INCLUDE_QUESTIONS:-true}"

# =============================================================================
# Validation
# =============================================================================

if [ -z "$BOT_TOKEN" ] || [ -z "$CHAT_ID" ]; then
    # Silent exit - don't spam logs if not configured
    exit 0
fi

# Check for required tools
if ! command -v jq &> /dev/null; then
    echo "Warning: jq not found, telegram notifications disabled" >&2
    exit 0
fi

if ! command -v curl &> /dev/null; then
    echo "Warning: curl not found, telegram notifications disabled" >&2
    exit 0
fi

# =============================================================================
# Localization
# =============================================================================

declare -A L10N_RU=(
    ["stop_event"]="завершил работу"
    ["notification_event"]="ждёт ответа"
    ["subagent_event"]="завершил подзадачу"
    ["unknown_event"]="событие"
    ["last_message"]="Последнее сообщение"
    ["ultrathink"]="Ultrathink"
    ["todo_status"]="TODO"
    ["completed"]="выполнено"
    ["questions"]="Вопросы Claude"
    ["plan"]="План"
    ["tools"]="Инструменты"
)

declare -A L10N_EN=(
    ["stop_event"]="finished working"
    ["notification_event"]="waiting for response"
    ["subagent_event"]="completed subtask"
    ["unknown_event"]="event"
    ["last_message"]="Last message"
    ["ultrathink"]="Ultrathink"
    ["todo_status"]="TODO"
    ["completed"]="completed"
    ["questions"]="Claude's questions"
    ["plan"]="Plan"
    ["tools"]="Tools"
)

# Get localized string
get_l10n() {
    local key="$1"
    if [ "$LANG" = "en" ]; then
        echo "${L10N_EN[$key]:-$key}"
    else
        echo "${L10N_RU[$key]:-$key}"
    fi
}

# =============================================================================
# Read Hook Input
# =============================================================================

INPUT=$(cat)

TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')
HOOK_EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // "Unknown"')
NOTIFICATION_MSG=$(echo "$INPUT" | jq -r '.message // empty')

# =============================================================================
# Check if this event should trigger notification
# =============================================================================

case "$HOOK_EVENT" in
    "Stop")
        [ "$NOTIFY_STOP" != "true" ] && exit 0
        EMOJI="✅"
        EVENT_NAME=$(get_l10n "stop_event")
        ;;
    "Notification")
        [ "$NOTIFY_WAITING" != "true" ] && exit 0

        # Check for delayed notification
        NOTIFY_DELAY="${TELEGRAM_NOTIFY_DELAY:-0}"

        # If delay is configured, launch background process
        if [ "$NOTIFY_DELAY" -gt 0 ] 2>/dev/null; then
            # Create state directory
            STATE_DIR="${HOME}/.claude/telegram-notifier"
            mkdir -p "$STATE_DIR"

            # Clean up old pending files (older than 5 minutes)
            find "$STATE_DIR" -name "pending_*.json" -mmin +5 -delete 2>/dev/null

            # Create unique state file
            SESSION_ID="$(date +%s)_$$_$RANDOM"
            STATE_FILE="${STATE_DIR}/pending_${SESSION_ID}.json"

            # Write state data
            cat > "$STATE_FILE" << EOF
{
  "transcript_path": "$TRANSCRIPT_PATH",
  "hook_event": "$HOOK_EVENT",
  "message": $(echo "$NOTIFICATION_MSG" | jq -Rs '.')
}
EOF

            # Launch delayed notification in background
            SCRIPT_DIR="$(dirname "$0")"
            nohup "$SCRIPT_DIR/telegram-delayed.sh" "$STATE_FILE" "$NOTIFY_DELAY" \
                > /dev/null 2>&1 &
            disown

            exit 0
        fi

        # Instant notification (delay=0)
        EMOJI="⏸️"
        EVENT_NAME=$(get_l10n "notification_event")
        ;;
    "SubagentStop")
        [ "$NOTIFY_SUBAGENT" != "true" ] && exit 0
        EMOJI="🔄"
        EVENT_NAME=$(get_l10n "subagent_event")
        ;;
    *)
        EMOJI="🤖"
        EVENT_NAME="$(get_l10n 'unknown_event'): $HOOK_EVENT"
        ;;
esac

# =============================================================================
# Helper Functions
# =============================================================================

# Escape HTML special characters
escape_html() {
    echo "$1" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g'
}

# Truncate text to specified length
truncate_text() {
    local text="$1"
    local max_len="${2:-1800}"

    if [ ${#text} -gt "$max_len" ]; then
        echo "${text:0:$max_len}..."
    else
        echo "$text"
    fi
}

# =============================================================================
# Build Message
# =============================================================================

MESSAGE="$EMOJI <b>Claude $EVENT_NAME</b>\n\n"

# Add notification message if present
if [ -n "$NOTIFICATION_MSG" ]; then
    NOTIFICATION_MSG_ESCAPED=$(escape_html "$NOTIFICATION_MSG")
    MESSAGE+="<i>$NOTIFICATION_MSG_ESCAPED</i>\n\n"
fi

# =============================================================================
# Process Transcript (if available)
# =============================================================================

if [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ]; then

    # --- Extract Last Assistant Message ---
    if [ "$INCLUDE_MESSAGE" = "true" ]; then
        LAST_TEXT=$(tac "$TRANSCRIPT_PATH" 2>/dev/null | \
            jq -r 'select(.type == "assistant") | .message.content[]? | select(.type == "text") | .text' 2>/dev/null | \
            head -1)
    fi

    # --- Extract Last Thinking (Ultrathink) ---
    if [ "$INCLUDE_THINKING" = "true" ]; then
        LAST_THINKING=$(tac "$TRANSCRIPT_PATH" 2>/dev/null | \
            jq -r 'select(.type == "assistant") | .message.content[]? | select(.type == "thinking") | .thinking' 2>/dev/null | \
            head -1)
    fi

    # --- Extract Tool Uses ---
    if [ "$INCLUDE_TOOLS" = "true" ]; then
        TOOLS=$(tac "$TRANSCRIPT_PATH" 2>/dev/null | \
            jq -r 'select(.type == "assistant") | .message.content[]? | select(.type == "tool_use") | .name' 2>/dev/null | \
            head -10)
    fi

    # --- Extract Last TODO State ---
    if [ "$INCLUDE_TODO" = "true" ]; then
        TODO_JSON=$(tac "$TRANSCRIPT_PATH" 2>/dev/null | \
            jq -r 'select(.type == "assistant") | .message.content[]? | select(.type == "tool_use" and .name == "TodoWrite") | .input.todos | @json' 2>/dev/null | \
            head -1)
    fi

    # --- Extract AskUserQuestion Data ---
    if [ "$INCLUDE_QUESTIONS" = "true" ]; then
        ASK_USER_JSON=$(tac "$TRANSCRIPT_PATH" 2>/dev/null | \
            jq -r 'select(.type == "assistant") | .message.content[]? | select(.type == "tool_use" and .name == "AskUserQuestion") | .input | @json' 2>/dev/null | \
            head -1)
    fi

    # --- Skip empty notifications (except for Notification events) ---
    if [ -z "$LAST_TEXT" ] && [ -z "$LAST_THINKING" ] && [ -z "$TOOLS" ] && [ -z "$TODO_JSON" ] && [ "$HOOK_EVENT" != "Notification" ]; then
        exit 0
    fi

    # --- Add Last Message ---
    if [ -n "$LAST_TEXT" ] && [ "$INCLUDE_MESSAGE" = "true" ]; then
        LAST_TEXT_TRUNCATED=$(truncate_text "$LAST_TEXT" 1800)
        LAST_TEXT_ESCAPED=$(escape_html "$LAST_TEXT_TRUNCATED")
        MESSAGE+="📝 <b>$(get_l10n 'last_message'):</b>\n<code>$LAST_TEXT_ESCAPED</code>\n\n"
    fi

    # --- Add Ultrathink ---
    if [ -n "$LAST_THINKING" ] && [ "$INCLUDE_THINKING" = "true" ]; then
        THINKING_TRUNCATED=$(truncate_text "$LAST_THINKING" 1800)
        THINKING_ESCAPED=$(escape_html "$THINKING_TRUNCATED")
        MESSAGE+="💭 <b>$(get_l10n 'ultrathink'):</b>\n<code>$THINKING_ESCAPED</code>\n\n"
    fi

    # --- Add TODO Status ---
    if [ -n "$TODO_JSON" ] && [ "$INCLUDE_TODO" = "true" ]; then
        TODO_TOTAL=$(echo "$TODO_JSON" | jq -r '. | length' 2>/dev/null || echo "0")
        TODO_COMPLETED=$(echo "$TODO_JSON" | jq -r '[.[] | select(.status == "completed")] | length' 2>/dev/null || echo "0")
        TODO_IN_PROGRESS=$(echo "$TODO_JSON" | jq -r '[.[] | select(.status == "in_progress")] | length' 2>/dev/null || echo "0")

        MESSAGE+="📋 <b>$(get_l10n 'todo_status') ($TODO_COMPLETED/$TODO_TOTAL $(get_l10n 'completed')):</b>\n"

        # Show in_progress tasks
        if [ "$TODO_IN_PROGRESS" -gt 0 ]; then
            TODO_IN_PROGRESS_LIST=$(echo "$TODO_JSON" | jq -r '.[] | select(.status == "in_progress") | "🔄 " + .content' 2>/dev/null)
            while IFS= read -r task; do
                if [ -n "$task" ]; then
                    TASK_ESCAPED=$(escape_html "$task")
                    MESSAGE+="$TASK_ESCAPED\n"
                fi
            done <<< "$TODO_IN_PROGRESS_LIST"
        fi

        # Show pending tasks (max 3)
        TODO_PENDING_LIST=$(echo "$TODO_JSON" | jq -r '.[] | select(.status == "pending") | "⏳ " + .content' 2>/dev/null | head -3)
        while IFS= read -r task; do
            if [ -n "$task" ]; then
                TASK_ESCAPED=$(escape_html "$task")
                MESSAGE+="$TASK_ESCAPED\n"
            fi
        done <<< "$TODO_PENDING_LIST"

        # Show recently completed tasks (max 2)
        TODO_COMPLETED_LIST=$(echo "$TODO_JSON" | jq -r '.[] | select(.status == "completed") | "✅ " + .content' 2>/dev/null | tail -2)
        while IFS= read -r task; do
            if [ -n "$task" ]; then
                TASK_ESCAPED=$(escape_html "$task")
                MESSAGE+="$TASK_ESCAPED\n"
            fi
        done <<< "$TODO_COMPLETED_LIST"

        MESSAGE+="\n"
    fi

    # --- Add AskUserQuestion ---
    if [ -n "$ASK_USER_JSON" ] && [ "$INCLUDE_QUESTIONS" = "true" ]; then
        QUESTIONS_TEXT=$(echo "$ASK_USER_JSON" | jq -r '
            .questions[] |
            "[\(.header // "Question")]: \(.question)\n" +
            (.options | map("  • \(.label): \(.description // "")") | join("\n"))
        ' 2>/dev/null)

        if [ -n "$QUESTIONS_TEXT" ]; then
            QUESTIONS_ESCAPED=$(escape_html "$QUESTIONS_TEXT")
            MESSAGE+="❓ <b>$(get_l10n 'questions'):</b>\n<code>$QUESTIONS_ESCAPED</code>\n\n"
        fi
    fi

    # --- Read Plan File (if modified in last 5 minutes) ---
    if [ "$INCLUDE_PLAN" = "true" ]; then
        PLAN_DIR="${HOME}/.claude/plans"
        if [ -d "$PLAN_DIR" ]; then
            PLAN_FILE=$(find "$PLAN_DIR" -name "*.md" -mmin -5 -type f 2>/dev/null | head -1)

            if [ -n "$PLAN_FILE" ] && [ -f "$PLAN_FILE" ]; then
                PLAN_CONTENT=$(head -c 1500 "$PLAN_FILE" 2>/dev/null)
                PLAN_SIZE=$(wc -c < "$PLAN_FILE" 2>/dev/null || echo "0")
                if [ "$PLAN_SIZE" -gt 1500 ]; then
                    PLAN_CONTENT="${PLAN_CONTENT}..."
                fi

                PLAN_ESCAPED=$(escape_html "$PLAN_CONTENT")
                PLAN_NAME=$(basename "$PLAN_FILE")
                MESSAGE+="📋 <b>$(get_l10n 'plan') ($PLAN_NAME):</b>\n<pre>$PLAN_ESCAPED</pre>\n\n"
            fi
        fi
    fi

    # --- Add Tools Summary ---
    if [ -n "$TOOLS" ] && [ "$INCLUDE_TOOLS" = "true" ]; then
        TOOL_SUMMARY=$(echo "$TOOLS" | sort | uniq -c | sort -rn | head -5)

        if [ -n "$TOOL_SUMMARY" ]; then
            MESSAGE+="🛠️ <b>$(get_l10n 'tools'):</b>\n"
            while read -r count tool; do
                if [ -n "$tool" ]; then
                    MESSAGE+="• $tool (${count}x)\n"
                fi
            done <<< "$TOOL_SUMMARY"
            MESSAGE+="\n"
        fi
    fi
fi

# =============================================================================
# Truncate Message to Telegram Limit
# =============================================================================

MESSAGE=$(echo -e "$MESSAGE" | head -c "$MSG_LIMIT")

# =============================================================================
# Send to Telegram
# =============================================================================

TELEGRAM_API="https://api.telegram.org/bot${BOT_TOKEN}/sendMessage"

# Build curl arguments
CURL_ARGS=(
    -s
    -X POST
    "$TELEGRAM_API"
    -d "chat_id=$CHAT_ID"
    -d "parse_mode=HTML"
    --data-urlencode "text=$MESSAGE"
)

# Add thread_id if specified (for topics in supergroups)
if [ -n "$THREAD_ID" ]; then
    CURL_ARGS+=(-d "message_thread_id=$THREAD_ID")
fi

# Send message (suppress output)
curl "${CURL_ARGS[@]}" > /dev/null 2>&1

exit 0
