#!/bin/bash
# Pre-commit hook для .NET проектов

set -e

echo "Pre-commit checks..."

# 1. Форматирование кода
echo "  -> Formatting code..."
dotnet format --verify-no-changes --verbosity quiet 2>/dev/null || {
    echo "    Code not formatted. Running dotnet format..."
    dotnet format
    git add -u
}

# 2. Сборка проекта
echo "  -> Building project..."
dotnet build --no-restore --verbosity quiet || {
    echo "    Build failed! Fix errors before committing."
    exit 1
}

# 3. Запуск тестов
echo "  -> Running tests..."
dotnet test --no-build --verbosity quiet || {
    echo "    Tests failed! Fix tests before committing."
    exit 1
}

echo "Pre-commit checks passed!"
exit 0
