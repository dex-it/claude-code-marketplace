#!/bin/bash

# Скрипт установки Node.js, npm и npx (Linux и macOS)

set -e

OS="$(uname -s)"

echo "====================================="
echo "Установка Node.js, npm и npx"
echo "====================================="
echo ""

# Проверка наличия curl
if ! command -v curl &> /dev/null; then
    echo "❌ curl не установлен. Установите curl:"
    if [ "$OS" = "Darwin" ]; then
        echo "   brew install curl   (в большинстве версий macOS curl уже есть)"
    else
        echo "   sudo apt-get install curl   (Debian/Ubuntu; для dnf/pacman/apk - аналог)"
    fi
    exit 1
fi

# Проверка Node.js
echo "🔍 Проверка Node.js..."
if command -v node &> /dev/null; then
    echo "✅ Node.js уже установлен: $(node --version)"
    NODE_INSTALLED=true
else
    echo "⚠️  Node.js не установлен"
    NODE_INSTALLED=false
fi

echo ""

# Проверка npm
echo "🔍 Проверка npm..."
if command -v npm &> /dev/null; then
    echo "✅ npm уже установлен: $(npm --version)"
    NPM_INSTALLED=true
else
    echo "⚠️  npm не установлен"
    NPM_INSTALLED=false
fi

echo ""

# Проверка npx
echo "🔍 Проверка npx..."
if command -v npx &> /dev/null; then
    echo "✅ npx уже установлен: $(npx --version)"
    NPX_INSTALLED=true
else
    echo "⚠️  npx не установлен"
    NPX_INSTALLED=false
fi

echo ""

# Если всё установлено - выходим
if [ "$NODE_INSTALLED" = true ] && [ "$NPM_INSTALLED" = true ] && [ "$NPX_INSTALLED" = true ]; then
    echo "✅ Все компоненты уже установлены"
    echo ""
    echo "Node.js: $(node --version)"
    echo "npm:     $(npm --version)"
    echo "npx:     $(npx --version)"
    echo ""
    echo "Следующие шаги:"
    echo "1. Установите MCP серверы с помощью ./install-context7.sh"
    exit 0
fi

# Установка Node.js
if [ "$OS" = "Darwin" ]; then
    # macOS: ставим через Homebrew (включает npm и npx)
    echo "📦 Установка Node.js через Homebrew (macOS)..."
    if ! command -v brew &> /dev/null; then
        echo "❌ Homebrew не найден. Установите его: https://brew.sh"
        echo "   затем повторно запустите ./install.sh"
        exit 1
    fi
    brew install node
else
    # Linux: NodeSource (LTS) или репозиторий дистрибутива
    echo "📦 Варианты установки Node.js (Linux):"
    echo ""
    echo "1) NodeSource (рекомендуется) - последняя LTS версия"
    echo "2) Из стандартного репозитория дистрибутива (apt)"
    echo "3) Отменить установку"
    echo ""

    read -p "Выберите вариант (1-3): " choice

    case $choice in
        1)
            echo ""
            echo "📦 Установка Node.js через NodeSource..."
            curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
            apt-get install -y nodejs
            ;;
        2)
            echo ""
            echo "📦 Установка Node.js из репозитория дистрибутива..."
            apt-get update
            apt-get install -y nodejs npm
            ;;
        3)
            echo "❌ Установка отменена"
            exit 1
            ;;
        *)
            echo "❌ Неверный выбор"
            exit 1
            ;;
    esac
fi

echo ""

# Проверка установки
echo "🔍 Проверка установки..."

if command -v node &> /dev/null; then
    echo "✅ Node.js установлен: $(node --version)"
else
    echo "❌ Node.js не найден после установки"
    exit 1
fi

if command -v npm &> /dev/null; then
    echo "✅ npm установлен: $(npm --version)"
else
    echo "❌ npm не найден после установки"
    exit 1
fi

if command -v npx &> /dev/null; then
    echo "✅ npx доступен: $(npx --version)"
else
    echo "⚠️  npx не найден (обычно устанавливается с npm)"
fi

echo ""
echo "====================================="
echo "✅ Установка завершена!"
echo "====================================="
echo ""
echo "Установлено:"
echo "  Node.js: $(node --version)"
echo "  npm:     $(npm --version)"
echo "  npx:     $(npx --version 2>&1 || echo 'не найден')"
echo ""
echo "Следующие шаги:"
echo "1. Установите MCP серверы:"
echo "   ./install-context7.sh"
echo ""
