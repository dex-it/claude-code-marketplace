#!/bin/bash

# Загружает переменные из .env в текущую сессию bash
# НЕ сохраняет их навсегда — только для этой сессии
# Поддерживает дефолтные ключи через CLAUDE_ARGS в .env
# Загружает системный промпт из файла system-prompt.md

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Функции для цветного вывода
print_error() { echo -e "${RED}$@${NC}"; }
print_success() { echo -e "${GREEN}$@${NC}"; }
print_warning() { echo -e "${YELLOW}$@${NC}"; }
print_info() { echo -e "${CYAN}$@${NC}"; }
print_header() { echo -e "${MAGENTA}$@${NC}"; }
print_variable() { echo -e "${GRAY}$@${NC}"; }

# Проверка наличия .env
if [ ! -f ".env" ]; then
    print_error "❌ ОШИБКА: Файл .env не найден!"
    exit 1
fi

CLAUDE_ARGS=""
SYSTEM_PROMPT_TEXT=""

print_header ""
print_header "======================================"
print_header "📋 Загрузка переменных окружения"
print_header "======================================"
print_header ""

# Загрузка переменных из .env
while IFS= read -r line || [ -n "$line" ]; do
    # Убираем пробелы в начале и конце
    line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

    # Пропускаем пустые строки и комментарии
    [[ -z "$line" || "$line" =~ ^#.* ]] && continue

    # Проверяем, что строка содержит '='
    if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
        key="${BASH_REMATCH[1]}"
        value="${BASH_REMATCH[2]}"

        # Убираем пробелы
        key=$(echo "$key" | xargs)
        value=$(echo "$value" | xargs)

        # Пропускаем, если ключ пустой
        [[ -z "$key" ]] && continue

        # Экспортируем переменную только если есть ключ
        export "$key=$value"

        # Сохраняем CLAUDE_ARGS отдельно
        if [ "$key" = "CLAUDE_ARGS" ]; then
            CLAUDE_ARGS="$value"
        fi

        print_variable "  ✓ Установлена переменная: $key"
    fi
done < ".env"

# Загрузка системного промпта из файла
print_header ""
print_header "======================================"
print_header "📝 Загрузка системного промпта"
print_header "======================================"
print_header ""

SYSTEM_PROMPT_FILE="./system-prompt.md"
if [ -f "$SYSTEM_PROMPT_FILE" ]; then
    print_info "  ℹ️  Читаем файл: $SYSTEM_PROMPT_FILE"

    # Читаем весь файл
    SYSTEM_PROMPT_TEXT=$(cat "$SYSTEM_PROMPT_FILE")

    CHAR_COUNT=$(echo -n "$SYSTEM_PROMPT_TEXT" | wc -c)
    print_success "  ✅ Промпт успешно загружен ($CHAR_COUNT символов)"
else
    print_warning "  ⚠️  Файл $SYSTEM_PROMPT_FILE не найден - используется стандартный промпт"
fi

print_header ""
print_header "======================================"
print_header "🔌 Регистрация MCP серверов"
print_header "======================================"
print_header ""

# Confluence MCP
if [ -n "$CONFLUENCE_MCP_URL" ] && [ -n "$CONFLUENCE_MCP_TOKEN" ]; then
    print_info "  → Регистрируем Confluence MCP..."
    claude mcp add --transport http conflu --scope user "$CONFLUENCE_MCP_URL" --header "Authorization: Token $CONFLUENCE_MCP_TOKEN"
    print_success "  ✅ Confluence MCP зарегистрирован: $CONFLUENCE_MCP_URL"
elif [ -z "$CONFLUENCE_MCP_URL" ]; then
    print_warning "  ⏭️  Confluence MCP пропущен: URL не задан (CONFLUENCE_MCP_URL)"
else
    print_warning "  ⏭️  Confluence MCP пропущен: токен не задан (CONFLUENCE_MCP_TOKEN)"
fi

# Jira MCP
if [ -n "$JIRA_MCP_URL" ] && [ -n "$JIRA_MCP_TOKEN" ]; then
    print_info "  → Регистрируем Jira MCP..."
    claude mcp add --transport http jira --scope user "$JIRA_MCP_URL" --header "Authorization: Token $JIRA_MCP_TOKEN"
    print_success "  ✅ Jira MCP зарегистрирован: $JIRA_MCP_URL"
elif [ -z "$JIRA_MCP_URL" ]; then
    print_warning "  ⏭️  Jira MCP пропущен: URL не задан (JIRA_MCP_URL)"
else
    print_warning "  ⏭️  Jira MCP пропущен: токен не задан (JIRA_MCP_TOKEN)"
fi

print_header ""
print_header "======================================"
print_header "🚀 Запуск Claude Code"
print_header "======================================"
print_header ""

cd ..

# Комбинируем промпт из файла + CLAUDE_ARGS
if [ -n "$SYSTEM_PROMPT_TEXT" ]; then
    FINAL_ARGS="$CLAUDE_ARGS --append-system-prompt \"$SYSTEM_PROMPT_TEXT\""
    print_info "  📌 Применяем кастомный системный промпт"
else
    FINAL_ARGS="$CLAUDE_ARGS"
fi

if [ -n "$FINAL_ARGS" ]; then
    print_variable "  🔧 Аргументы: $FINAL_ARGS"
    echo ""
fi

# Запускаем Claude с финальными аргументами
if [ -z "$FINAL_ARGS" ]; then
    claude "$@"
else
    eval "claude $FINAL_ARGS \"$@\""
fi

echo ""
read -p "Нажмите Enter для выхода..."
