#!/bin/bash
# Format check for Python files after Write/Edit

FILE="$1"

# Check if it's a Python file
if [[ "$FILE" == *.py ]]; then
    echo "Checking format for: $FILE"

    # Check if black is available
    if command -v black &> /dev/null; then
        black --check --quiet "$FILE" 2>/dev/null || {
            echo "⚠️  Format issue detected. Run: black $FILE"
        }
    fi

    # Check if isort is available
    if command -v isort &> /dev/null; then
        isort --check-only --quiet "$FILE" 2>/dev/null || {
            echo "⚠️  Import order issue. Run: isort $FILE"
        }
    fi

    # Check if mypy is available (optional - can be slow)
    # Uncomment to enable type checking on every write
    # if command -v mypy &> /dev/null; then
    #     mypy --no-error-summary "$FILE" 2>/dev/null || {
    #         echo "⚠️  Type check failed. Run: mypy $FILE"
    #     }
    # fi
fi

exit 0
