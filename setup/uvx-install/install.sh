#!/bin/bash

# Скрипт установки uv и uvx

set -e

echo "========================="
echo "Установка uv и uvx"
echo "========================="
echo ""

# Проверка наличия curl
if ! command -v curl &> /dev/null; then
    echo "❌ curl не установлен. Установите curl:"
    echo "   apt-get install curl"
    exit 1
fi

# Проверка uv
echo "🔍 Проверка uv..."
if command -v uv &> /dev/null; then
    echo "✅ uv уже установлен: $(uv --version)"
    UV_INSTALLED=true
else
    echo "⚠️  uv не установлен"
    UV_INSTALLED=false
fi

echo ""

# Проверка uvx
echo "🔍 Проверка uvx..."
if command -v uvx &> /dev/null; then
    echo "✅ uvx уже доступен"
    UVX_INSTALLED=true
else
    echo "⚠️  uvx не найден"
    UVX_INSTALLED=false
fi

echo ""

# Если всё установлено - выходим
if [ "$UV_INSTALLED" = true ] && [ "$UVX_INSTALLED" = true ]; then
    echo "✅ Все компоненты уже установлены"
    echo ""
    echo "uv:  $(uv --version)"
    echo "uvx: доступен"
    echo ""
    echo "Следующие шаги:"
    echo "1. Установите MCP серверы с помощью ./install-postgres-mcp.sh"
    exit 0
fi

# Установка uv
echo "📦 Установка uv..."
curl -LsSf https://astral.sh/uv/install.sh | sh

# Добавление uv в PATH для текущей сессии
echo ""
echo "📝 Настройка PATH..."

# Определение shell конфигурационного файла
if [ -n "$ZSH_VERSION" ]; then
    SHELL_RC="$HOME/.zshrc"
elif [ -n "$BASH_VERSION" ]; then
    SHELL_RC="$HOME/.bashrc"
else
    SHELL_RC="$HOME/.profile"
fi

# Добавление uv в PATH, если еще не добавлено
UV_PATH_EXPORT='export PATH="$HOME/.cargo/bin:$PATH"'
if ! grep -q ".cargo/bin" "$SHELL_RC" 2>/dev/null; then
    echo "" >> "$SHELL_RC"
    echo "# uv (uvx) path" >> "$SHELL_RC"
    echo "$UV_PATH_EXPORT" >> "$SHELL_RC"
    echo "✅ Добавлен PATH в $SHELL_RC"
else
    echo "✅ PATH уже настроен в $SHELL_RC"
fi

# Загрузка PATH для текущей сессии
export PATH="$HOME/.cargo/bin:$PATH"

# Проверка установки
echo ""
echo "🔍 Проверка установки..."
if command -v uv &> /dev/null; then
    echo "✅ uv установлен: $(uv --version)"
else
    echo "⚠️  uv не найден в PATH. Выполните:"
    echo "   source $SHELL_RC"
    echo "   или перезапустите терминал"
fi

if command -v uvx &> /dev/null; then
    echo "✅ uvx доступен"
else
    echo "⚠️  uvx не найден. Обычно uvx - это симлинк на uv"
    if [ -f "$HOME/.cargo/bin/uv" ]; then
        echo "   Создание симлинка uvx..."
        ln -sf "$HOME/.cargo/bin/uv" "$HOME/.cargo/bin/uvx"
        echo "✅ Симлинк uvx создан"
    fi
fi

echo ""
echo "========================="
echo "✅ Установка завершена!"
echo "========================="
echo ""
echo "Установлено:"
echo "  uv:  $(uv --version 2>&1 || echo 'проверьте PATH')"
echo "  uvx: $(uvx --version 2>&1 || echo 'доступен')"
echo ""
echo "Следующие шаги:"
echo "1. Перезапустите терминал или выполните:"
echo "   source $SHELL_RC"
echo ""
echo "2. Проверьте установку:"
echo "   uv --version"
echo "   uvx --version"
echo ""
echo "3. Установите MCP серверы:"
echo "   ./install-postgres-mcp.sh"
echo ""
