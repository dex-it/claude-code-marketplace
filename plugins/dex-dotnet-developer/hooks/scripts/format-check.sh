#!/bin/bash
# Format check for C# files after Write/Edit

FILE="$1"

# Check if it's a C# file
if [[ "$FILE" == *.cs ]]; then
    echo "Checking format for: $FILE"
    # Could run dotnet format on the file
    # dotnet format --include "$FILE" --verify-no-changes
fi

exit 0
