#!/bin/bash

# Скрипт установки Context7 MCP сервера через npx

set -e

COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[1;33m'
COLOR_RED='\033[0;31m'
COLOR_BLUE='\033[0;34m'
COLOR_RESET='\033[0m'

# Значения по умолчанию
SCOPE="user"  # По умолчанию глобальная установка

# Функция вывода справки
show_help() {
    cat << EOF
Использование: ./install-context7.sh [ОПЦИИ]

Скрипт установки Context7 MCP сервера для Claude Code.
По умолчанию устанавливает в глобальную область (user scope).

ОПЦИИ:
    --scope SCOPE    Область установки: user, local, или project
                     По умолчанию: user (глобально, для всех проектов)

    -h, --help       Показать эту справку

ПРИМЕРЫ:
    ./install-context7.sh                    # Глобальная установка (user scope)
    ./install-context7.sh --scope local      # Локальная установка (текущий проект)
    ./install-context7.sh --scope project    # Проектная установка (для команды)

ОБЛАСТИ УСТАНОВКИ:
    user     - Доступен во всех ваших проектах (рекомендуется)
    local    - Только для текущего проекта
    project  - Для команды через .mcp.json (попадает в git)

EOF
    exit 0
}

# Парсинг аргументов командной строки
while [[ $# -gt 0 ]]; do
    case $1 in
        --scope)
            SCOPE="$2"
            if [[ ! "$SCOPE" =~ ^(user|local|project)$ ]]; then
                echo -e "${COLOR_RED}Ошибка: Неверное значение scope '$SCOPE'${COLOR_RESET}"
                echo "Допустимые значения: user, local, project"
                exit 1
            fi
            shift 2
            ;;
        -h|--help)
            show_help
            ;;
        *)
            echo -e "${COLOR_RED}Ошибка: Неизвестный параметр '$1'${COLOR_RESET}"
            echo "Используйте --help для справки"
            exit 1
            ;;
    esac
done

# Вывод информации о scope
SCOPE_DESCRIPTION=""
case $SCOPE in
    user)
        SCOPE_DESCRIPTION="глобально (для всех проектов)"
        ;;
    local)
        SCOPE_DESCRIPTION="локально (только текущий проект)"
        ;;
    project)
        SCOPE_DESCRIPTION="для команды (через .mcp.json в git)"
        ;;
esac

echo -e "${COLOR_BLUE}=========================================${COLOR_RESET}"
echo -e "${COLOR_BLUE}Установка Context7 MCP сервера через npx${COLOR_RESET}"
echo -e "${COLOR_BLUE}=========================================${COLOR_RESET}"
echo -e "${COLOR_BLUE}Область установки: ${COLOR_YELLOW}${SCOPE}${COLOR_BLUE} (${SCOPE_DESCRIPTION})${COLOR_RESET}\n"

# Проверка npx
echo -e "${COLOR_YELLOW}Проверка зависимостей${COLOR_RESET}"
if ! command -v npx &> /dev/null; then
    echo -e "${COLOR_RED}✗ npx не установлен${COLOR_RESET}"
    echo ""
    echo "Сначала выполните:"
    echo "  ./install.sh"
    exit 1
fi

echo -e "${COLOR_GREEN}✓${COLOR_RESET} npx установлен: $(npx --version)"
echo -e "${COLOR_GREEN}✓${COLOR_RESET} Node.js: $(node --version)"
echo -e "${COLOR_GREEN}✓${COLOR_RESET} npm: $(npm --version)"

echo ""

# Проверка Claude CLI
echo -e "${COLOR_YELLOW}Проверка Claude CLI${COLOR_RESET}"
if ! command -v claude &> /dev/null; then
    echo -e "${COLOR_RED}✗ Claude CLI не найден${COLOR_RESET}"
    echo "Установите Claude CLI: https://claude.com/code"
    exit 1
fi

echo -e "${COLOR_GREEN}✓${COLOR_RESET} Claude CLI установлен"

echo ""

# Тестовый запуск context7 MCP
echo -e "${COLOR_YELLOW}Проверка @upstash/context7-mcp${COLOR_RESET}"
echo "Попытка загрузить пакет..."
if timeout 30s npx -y @upstash/context7-mcp --version 2>/dev/null || npx -y @upstash/context7-mcp --help 2>&1 | head -n 5; then
    echo -e "${COLOR_GREEN}✓ @upstash/context7-mcp доступен${COLOR_RESET}"
else
    echo -e "${COLOR_YELLOW}⚠ Не удалось проверить версию, но пакет может работать${COLOR_RESET}"
fi

echo ""

# Добавление context7 в Claude MCP
echo -e "${COLOR_YELLOW}Установка Context7 MCP сервера${COLOR_RESET}"
echo "Команда: claude mcp add --transport stdio context7 --scope ${SCOPE} -- npx -y @upstash/context7-mcp"
echo ""

# Проверка, установлен ли уже context7 в любой области
EXISTING_SCOPE=""
if claude mcp get context7 &> /dev/null; then
    EXISTING_SCOPE=$(claude mcp get context7 2>/dev/null | grep -i "scope:" | head -1)
    echo -e "${COLOR_YELLOW}Context7 уже установлен:${COLOR_RESET}"
    echo "$EXISTING_SCOPE"
    read -p "Переустановить с scope '${SCOPE}'? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[YyДд]$ ]]; then
        # Удаляем из всех возможных областей
        for s in user local project; do
            claude mcp remove context7 -s "$s" 2>/dev/null || true
        done
        echo -e "${COLOR_GREEN}✓ Старая конфигурация удалена${COLOR_RESET}"
    else
        echo -e "${COLOR_BLUE}Установка пропущена.${COLOR_RESET}"
        exit 0
    fi
fi

echo "Добавление context7 с scope '${SCOPE}'..."
if claude mcp add --transport stdio context7 --scope "${SCOPE}" -- npx -y @upstash/context7-mcp; then
    echo -e "${COLOR_GREEN}✓ Context7 MCP успешно добавлен (scope: ${SCOPE})${COLOR_RESET}"
else
    echo -e "${COLOR_RED}✗ Ошибка при добавлении Context7${COLOR_RESET}"
    exit 1
fi

echo ""

# Проверка установки
echo -e "${COLOR_YELLOW}Проверка установки${COLOR_RESET}"
echo "Список MCP серверов:"
claude mcp list

echo ""
echo -e "${COLOR_GREEN}=== Установка завершена ===${COLOR_RESET}"
echo ""
echo -e "Context7 установлен с областью: ${COLOR_YELLOW}${SCOPE}${COLOR_RESET} (${SCOPE_DESCRIPTION})"
echo ""
echo "Для проверки работы Context7 в Claude Code используйте команду:"
echo "  /mcp"
echo ""
echo "Для просмотра конфигурации:"
echo "  claude mcp get context7"
echo ""
if [ "$SCOPE" != "user" ]; then
    echo -e "${COLOR_BLUE}Совет:${COLOR_RESET} Для глобальной установки используйте: ./install-context7.sh --scope user"
fi
