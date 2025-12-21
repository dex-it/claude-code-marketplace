#!/bin/bash

# Скрипт установки postgres-mcp через uvx

set -e

echo "========================================="
echo "Установка postgres-mcp через uvx"
echo "========================================="
echo ""

# Проверка зависимостей
echo "Проверка зависимостей"
if ! command -v uvx &> /dev/null; then
    echo "❌ uvx не установлен"
    echo ""
    echo "Сначала выполните:"
    echo "  ./install.sh"
    exit 1
fi

echo "✅ uvx найден: $(uvx --version 2>&1 || uv --version)"
echo ""

# Проверка и настройка DATABASE_URL
echo "Проверка DATABASE_URL"
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  Переменная DATABASE_URL не установлена"
    echo ""
    echo "Для работы postgres-mcp необходимо установить DATABASE_URL."
    echo ""
    echo "Хотите настроить сейчас? (y/n)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo ""
        echo "Введите DATABASE_URL (или оставьте пустым для примера):"
        read -r db_url
        if [ -z "$db_url" ]; then
            db_url="postgresql://postgres:password@localhost:5432/database"
            echo "Использован пример: $db_url"
        fi

        # Определение shell конфигурационного файла
        if [ -n "$ZSH_VERSION" ]; then
            SHELL_RC="$HOME/.zshrc"
        elif [ -n "$BASH_VERSION" ]; then
            SHELL_RC="$HOME/.bashrc"
        else
            SHELL_RC="$HOME/.profile"
        fi

        # Добавление DATABASE_URL в shell RC
        if ! grep -q "export DATABASE_URL=" "$SHELL_RC" 2>/dev/null; then
            echo "" >> "$SHELL_RC"
            echo "# PostgreSQL MCP connection" >> "$SHELL_RC"
            echo "export DATABASE_URL='$db_url'" >> "$SHELL_RC"
            echo "✅ DATABASE_URL добавлен в $SHELL_RC"
        else
            echo "⚠️  DATABASE_URL уже присутствует в $SHELL_RC"
        fi

        export DATABASE_URL="$db_url"
        echo "✅ DATABASE_URL установлен для текущей сессии"
    else
        echo "⚠️  Продолжаем без DATABASE_URL"
        echo "   Установите его позже в ~/.bashrc или ~/.zshrc:"
        echo "   export DATABASE_URL='postgresql://user:password@host:port/database'"
    fi
else
    echo "✅ DATABASE_URL уже установлен"
fi

echo ""
echo "📦 Проверка postgres-mcp..."
echo "   uvx автоматически установит postgres-mcp при первом запуске"
echo ""
echo "🔍 Тестовый запуск (установит пакет автоматически)..."
if uvx postgres-mcp --help &> /dev/null; then
    echo "✅ postgres-mcp работает"
else
    echo "⚠️  Не удалось запустить postgres-mcp"
    echo "   Пакет установится автоматически при запуске через Claude Code"
fi

echo ""
echo "========================================="
echo "✅ Установка завершена!"
echo "========================================="
echo ""
echo "Следующие шаги:"
echo ""
echo "1. Перезапустите терминал или выполните:"
echo "   source ~/.bashrc  # или ~/.zshrc"
echo ""
echo "2. Настройте MCP сервер в Claude Code:"
echo "   claude mcp add --transport stdio postgres -- uvx postgres-mcp --access-mode=restricted"
echo ""
echo "   Или вручную в .claude/mcp.json:"
echo "   {"
echo "     \"mcpServers\": {"
echo "       \"postgres\": {"
echo "         \"command\": \"uvx\","
echo "         \"args\": [\"postgres-mcp\", \"--access-mode=restricted\"],"
echo "         \"env\": {"
echo "           \"DATABASE_URI\": \"\${DATABASE_URL}\""
echo "         }"
echo "       }"
echo "     }"
echo "   }"
echo ""
echo "3. Проверьте подключение:"
echo "   claude mcp list"
echo ""
