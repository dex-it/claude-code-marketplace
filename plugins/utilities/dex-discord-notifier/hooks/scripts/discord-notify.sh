#!/bin/bash
# =============================================================================
# Discord Notifier for Claude Code
# Part of dex-discord-notifier plugin
#
# Sends notifications to Discord when Claude Code events occur.
# Configuration via environment variables (see README.md)
# =============================================================================

# Exit silently on errors - never block Claude
set +e
# =============================================================================
# Configuration from Environment Variables
# =============================================================================

# Required
WEBHOOK_URL="${DISCORD_NOTIFIER_URL:-}"

# Optional settings with defaults
MSG_LIMIT="${DISCORD_MESSAGE_LIMIT:-4000}"
LANG="${DISCORD_LANGUAGE:-ru}"

# Feature toggles (all enabled by default)
NOTIFY_STOP="${DISCORD_NOTIFY_STOP:-true}"
NOTIFY_WAITING="${DISCORD_NOTIFY_WAITING:-true}"
NOTIFY_PERMISSIONS="${DISCORD_NOTIFY_PERMISSIONS:-true}"
NOTIFY_SUBAGENT="${DISCORD_NOTIFY_SUBAGENT:-true}"
INCLUDE_THINKING="${DISCORD_INCLUDE_THINKING:-false}"
INCLUDE_TOOLS="${DISCORD_INCLUDE_TOOLS:-true}"
INCLUDE_TODO="${DISCORD_INCLUDE_TODO:-true}"
INCLUDE_PLAN="${DISCORD_INCLUDE_PLAN:-true}"
INCLUDE_MESSAGE="${DISCORD_INCLUDE_MESSAGE:-true}"
INCLUDE_QUESTIONS="${DISCORD_INCLUDE_QUESTIONS:-true}"

# =============================================================================
# Validation
# =============================================================================

if [ -z "$WEBHOOK_URL" ]; then
    # Silent exit - don't spam logs if not configured
    exit 0
fi

# Check for required tools
if ! command -v jq &> /dev/null; then
    echo "Warning: jq not found, discord notifications disabled" >&2
    exit 0
fi

if ! command -v curl &> /dev/null; then
    echo "Warning: curl not found, discord notifications disabled" >&2
    exit 0
fi

# =============================================================================
# Localization
# =============================================================================

declare -A L10N_RU=(
    ["stop_event"]="завершил работу"
    ["notification_event"]="ждёт ответа"
    ["subagent_event"]="завершил подзадачу"
    ["permission_request"]="ждёт разрешение"
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
    ["permission_request"]="waiting for permissions"
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

COLOR=9807270  # Default: Gray

case "$HOOK_EVENT" in
    "Stop")
        [ "$NOTIFY_STOP" != "true" ] && exit 0
        EMOJI="✅"
        COLOR=3355443  # Green
        EVENT_NAME=$(get_l10n "stop_event")
        ;;
    "Notification")
        [ "$NOTIFY_WAITING" != "true" ] && exit 0
        EMOJI="⏸️"
        COLOR=16776960  # Yellow
        EVENT_NAME=$(get_l10n "notification_event")
        ;;
    "SubagentStop")
        [ "$NOTIFY_SUBAGENT" != "true" ] && exit 0
        EMOJI="🔄"
        COLOR=3447003  # Blue
        EVENT_NAME=$(get_l10n "subagent_event")
        ;;
    *)
        EMOJI="🤖"
        COLOR=9807270  # Gray
        EVENT_NAME="$(get_l10n 'unknown_event'): $HOOK_EVENT"
        ;;
esac

# =============================================================================
# Helper Functions
# =============================================================================

# Escape JSON special characters
escape_json() {
    echo "$1" | jq -Rs .
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
# Build Message Fields
# =============================================================================

FIELDS="[]"

# Add notification message if present
DESCRIPTION=""
if [ -n "$NOTIFICATION_MSG" ]; then
    DESCRIPTION=$(escape_json "$NOTIFICATION_MSG")
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
        LAST_TEXT_TRUNCATED=$(truncate_text "$LAST_TEXT" 1024)
        LAST_TEXT_ESCAPED=$(escape_json "$LAST_TEXT_TRUNCATED")
        FIELD_NAME=$(escape_json "📝 $(get_l10n 'last_message')")
        FIELDS=$(echo "$FIELDS" | jq --argjson name "$FIELD_NAME" --argjson value "$LAST_TEXT_ESCAPED" \
            '. += [{"name": $name, "value": $value, "inline": false}]')
    fi

    # --- Add Ultrathink ---
    if [ -n "$LAST_THINKING" ] && [ "$INCLUDE_THINKING" = "true" ]; then
        THINKING_TRUNCATED=$(truncate_text "$LAST_THINKING" 1024)
        THINKING_ESCAPED=$(escape_json "$THINKING_TRUNCATED")
        FIELD_NAME=$(escape_json "💭 $(get_l10n 'ultrathink')")
        FIELDS=$(echo "$FIELDS" | jq --argjson name "$FIELD_NAME" --argjson value "$THINKING_ESCAPED" \
            '. += [{"name": $name, "value": $value, "inline": false}]')
    fi

    # --- Add TODO Status ---
    if [ -n "$TODO_JSON" ] && [ "$INCLUDE_TODO" = "true" ]; then
        TODO_TOTAL=$(echo "$TODO_JSON" | jq -r '. | length' 2>/dev/null || echo "0")
        TODO_COMPLETED=$(echo "$TODO_JSON" | jq -r '[.[] | select(.status == "completed")] | length' 2>/dev/null || echo "0")
        TODO_IN_PROGRESS=$(echo "$TODO_JSON" | jq -r '[.[] | select(.status == "in_progress")] | length' 2>/dev/null || echo "0")

        TODO_TEXT="($TODO_COMPLETED/$TODO_TOTAL $(get_l10n 'completed'))"$'\n'

        # Show in_progress tasks
        if [ "$TODO_IN_PROGRESS" -gt 0 ]; then
            TODO_IN_PROGRESS_LIST=$(echo "$TODO_JSON" | jq -r '.[] | select(.status == "in_progress") | "🔄 " + .content' 2>/dev/null)
            while IFS= read -r task; do
                if [ -n "$task" ]; then
                    TODO_TEXT+="$task"$'\n'
                fi
            done <<< "$TODO_IN_PROGRESS_LIST"
        fi

        # Show pending tasks (max 3)
        TODO_PENDING_LIST=$(echo "$TODO_JSON" | jq -r '.[] | select(.status == "pending") | "⏳ " + .content' 2>/dev/null | head -3)
        while IFS= read -r task; do
            if [ -n "$task" ]; then
                TODO_TEXT+="$task\n"
            fi
        done <<< "$TODO_PENDING_LIST"

        # Show recently completed tasks (max 2)
        TODO_COMPLETED_LIST=$(echo "$TODO_JSON" | jq -r '.[] | select(.status == "completed") | "✅ " + .content' 2>/dev/null | tail -2)
        while IFS= read -r task; do
            if [ -n "$task" ]; then
                TODO_TEXT+="$task\n"
            fi
        done <<< "$TODO_COMPLETED_LIST"

        TODO_TEXT_TRUNCATED=$(truncate_text "$TODO_TEXT" 1024)
        TODO_ESCAPED=$(escape_json "$TODO_TEXT_TRUNCATED")
        FIELD_NAME=$(escape_json "📋 $(get_l10n 'todo_status')")
        FIELDS=$(echo "$FIELDS" | jq --argjson name "$FIELD_NAME" --argjson value "$TODO_ESCAPED" \
            '. += [{"name": $name, "value": $value, "inline": false}]')
    fi

    # --- Add AskUserQuestion ---
    if [ -n "$ASK_USER_JSON" ] && [ "$INCLUDE_QUESTIONS" = "true" ]; then
        QUESTIONS_TEXT=$(echo "$ASK_USER_JSON" | jq -r '
            .questions[] |
            "[\(.header // "Question")]: \(.question)\n" +
            (.options | map("  • \(.label): \(.description // "")") | join("\n"))
        ' 2>/dev/null)

        if [ -n "$QUESTIONS_TEXT" ]; then
            QUESTIONS_TRUNCATED=$(truncate_text "$QUESTIONS_TEXT" 1024)
            QUESTIONS_ESCAPED=$(escape_json "$QUESTIONS_TRUNCATED")
            FIELD_NAME=$(escape_json "❓ $(get_l10n 'questions')")
            FIELDS=$(echo "$FIELDS" | jq --argjson name "$FIELD_NAME" --argjson value "$QUESTIONS_ESCAPED" \
                '. += [{"name": $name, "value": $value, "inline": false}]')
        fi
    fi

    # --- Read Plan File (if modified in last 5 minutes) ---
    if [ "$INCLUDE_PLAN" = "true" ]; then
        PLAN_DIR="${HOME}/.claude/plans"
        if [ -d "$PLAN_DIR" ]; then
            PLAN_FILE=$(find "$PLAN_DIR" -name "*.md" -mmin -5 -type f 2>/dev/null | head -1)

            if [ -n "$PLAN_FILE" ] && [ -f "$PLAN_FILE" ]; then
                PLAN_CONTENT=$(head -c 1024 "$PLAN_FILE" 2>/dev/null)
                PLAN_SIZE=$(wc -c < "$PLAN_FILE" 2>/dev/null || echo "0")
                if [ "$PLAN_SIZE" -gt 1024 ]; then
                    PLAN_CONTENT="${PLAN_CONTENT}..."
                fi

                PLAN_ESCAPED=$(escape_json "$PLAN_CONTENT")
                PLAN_NAME=$(basename "$PLAN_FILE")
                FIELD_NAME=$(escape_json "📋 $(get_l10n 'plan') ($PLAN_NAME)")
                FIELDS=$(echo "$FIELDS" | jq --argjson name "$FIELD_NAME" --argjson value "$PLAN_ESCAPED" \
                    '. += [{"name": $name, "value": $value, "inline": false}]')
            fi
        fi
    fi

    # --- Add Tools Summary ---
    if [ -n "$TOOLS" ] && [ "$INCLUDE_TOOLS" = "true" ]; then
        TOOL_SUMMARY=$(echo "$TOOLS" | sort | uniq -c | sort -rn | head -5)

        if [ -n "$TOOL_SUMMARY" ]; then
            TOOLS_TEXT=""
            while read -r count tool; do
                if [ -n "$tool" ]; then
                    TOOLS_TEXT+="• $tool (${count}x)"$'\n'
                fi
            done <<< "$TOOL_SUMMARY"

            if [ -n "$TOOLS_TEXT" ]; then
                TOOLS_ESCAPED=$(escape_json "$TOOLS_TEXT")
                FIELD_NAME=$(escape_json "🛠️ $(get_l10n 'tools')")
                FIELDS=$(echo "$FIELDS" | jq --argjson name "$FIELD_NAME" --argjson value "$TOOLS_ESCAPED" \
                    '. += [{"name": $name, "value": $value, "inline": false}]')
            fi
        fi
    fi
fi

# =============================================================================
# Build Discord Embed
# =============================================================================

TITLE="$EMOJI Claude $EVENT_NAME"

EMBED=$(jq -n \
    --arg title "$TITLE" \
    --arg description "$NOTIFICATION_MSG" \
    --argjson color "$COLOR" \
    '{
        title: $title,
        description: (if $description == "" then null else $description end),
        color: $color,
        timestamp: (now | strftime("%Y-%m-%dT%H:%M:%S.000Z"))
    }')

# =============================================================================
# Build Final Payload
# =============================================================================

# Add fields to embed
EMBED=$(echo "$EMBED" | jq --argjson fields "$FIELDS" '. + {fields: $fields}')

PAYLOAD=$(jq -n \
    --argjson embed "$EMBED" \
    '{
        content: null,
        embeds: [$embed],
        attachments: []
    }')

# =============================================================================
# Queue for Deferred Sending
# =============================================================================

QUEUE_DIR="/tmp/discord-notify-queue"
LOCK_FILE="/tmp/discord-notify.lock"
TIMER_PID_FILE="/tmp/discord-notify-timer.pid"
DELAY_SECONDS="${DISCORD_NOTIFY_DELAY:-30}"

mkdir -p "$QUEUE_DIR"

# Deduplicate: hash the embed fields (content without title/color to catch Stop+SubagentStop dupes)
DEDUP_KEY=$(echo "$PAYLOAD" | jq -r '.embeds[0].fields // [] | tostring' 2>/dev/null | md5sum | cut -d' ' -f1)

# Atomic dedup: use mkdir as a lock (atomic on all filesystems)
DEDUP_LOCK="$QUEUE_DIR/.dedup_${DEDUP_KEY}"
if ! mkdir "$DEDUP_LOCK" 2>/dev/null; then
    # Another process already claimed this content — skip duplicate
    exit 0
fi

# Save payload to queue
QUEUE_FILE="$QUEUE_DIR/$(date +%s%N)_${DEDUP_KEY}.json"
echo "$PAYLOAD" > "$QUEUE_FILE"

# Check if timer is already running
if [ -f "$TIMER_PID_FILE" ]; then
    TIMER_PID=$(cat "$TIMER_PID_FILE" 2>/dev/null)
    if [ -n "$TIMER_PID" ] && kill -0 "$TIMER_PID" 2>/dev/null; then
        # Timer already running, just enqueued — exit
        exit 0
    fi
fi

# No timer running — start fully detached background flush timer
# Redirect all FDs and disown to prevent blocking Claude's hook
nohup bash -c "
    sleep $DELAY_SECONDS

    # Send all queued payloads
    for f in \"$QUEUE_DIR\"/*.json; do
        [ -f \"\$f\" ] || continue
        curl -s -H 'Content-Type: application/json' -X POST '$WEBHOOK_URL' -d @\"\$f\" > /dev/null 2>&1
    done

    # Cleanup
    rm -rf \"$QUEUE_DIR\"
    rm -f \"$TIMER_PID_FILE\"
" > /dev/null 2>&1 &

echo $! > "$TIMER_PID_FILE"
disown

exit 0
