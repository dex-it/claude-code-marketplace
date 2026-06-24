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

# Официальный установщик uv ставит uv, uvx и uvw в $HOME/.local/bin
# (до версии 0.5.0 - в $HOME/.cargo/bin) и сам дописывает PATH в профиль shell.
# Здесь только подхватываем PATH для текущей сессии - постоянную настройку
# делает сам установщик, дублировать запись в rc не нужно.
echo ""
echo "📝 Настройка PATH для текущей сессии..."

# Профиль shell - по текущей оболочке ($SHELL), а не по тому, чем запущен скрипт.
# На macOS оболочка по умолчанию zsh, и при запуске через bash $BASH_VERSION
# увёл бы подсказку в неверный ~/.bashrc.
case "$(basename "${SHELL:-}")" in
    zsh)  SHELL_RC="$HOME/.zshrc" ;;
    bash) SHELL_RC="$HOME/.bashrc" ;;
    *)    SHELL_RC="$HOME/.profile" ;;
esac

# PATH для текущей сессии: env-файл установщика, иначе оба возможных каталога uv
if [ -f "$HOME/.local/bin/env" ]; then
    . "$HOME/.local/bin/env"
else
    export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
fi

# Проверка установки
echo ""
echo "🔍 Проверка установки..."
if command -v uv &> /dev/null; then
    echo "✅ uv установлен: $(uv --version)"
else
    echo "⚠️  uv не найден в PATH. Перезапустите терминал или выполните:"
    echo "   source \"$HOME/.local/bin/env\""
fi

if command -v uvx &> /dev/null; then
    echo "✅ uvx доступен"
else
    echo "⚠️  uvx не найден в PATH. Установщик uv ставит uvx рядом с uv в \$HOME/.local/bin."
    echo "   Перезапустите терминал или выполните: source \"\$HOME/.local/bin/env\""
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
