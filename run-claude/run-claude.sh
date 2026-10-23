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

# Значение из .env: срезаем пробелы с обеих сторон, затем обрамляющие кавычки. Хвост важен отдельно:
# [[:space:]] покрывает CR, иначе .env с CRLF уносит ^M в URL и в заголовок Authorization.
trim_env_value() {
    local v="$1"
    v="${v#"${v%%[![:space:]]*}"}"
    v="${v%"${v##*[![:space:]]}"}"
    case "$v" in
        \"*\") v="${v#\"}"; v="${v%\"}" ;;
        \'*\') v="${v#\'}"; v="${v%\'}" ;;
    esac
    printf '%s' "$v"
}

# Имя переменной из .env: только [A-Za-z_][A-Za-z0-9_]*, и не из тех, что меняют поведение процессов.
# Имя тоже исполняет код: BASH_ENV=$(...) раскрывается при старте любого bash-скрипта (в том числе pass),
# GIT_CONFIG_*, LD_PRELOAD, NODE_OPTIONS, PATH делают то же для git, node и любой команды.
# Отброшенное имя не экспортируется; код возврата 1, предупреждение в stderr.
env_key_allowed() {
    local key="$1"
    if [[ ! "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
        echo "ПРЕДУПРЕЖДЕНИЕ: $key: недопустимое имя переменной, строка пропущена" >&2
        return 1
    fi
    case "$key" in
        BASH_ENV|ENV|PS4|PROMPT_COMMAND|SHELLOPTS|BASHOPTS|PATH|NODE_OPTIONS|LD_*|DYLD_*|GIT_CONFIG_*|GIT_SSH*|GIT_*PAGER|GIT_EXTERNAL_DIFF|GIT_ASKPASS|GIT_EDITOR)
            echo "ПРЕДУПРЕЖДЕНИЕ: $key: имя меняет поведение запускаемых процессов, переменная не экспортирована" >&2
            return 1 ;;
    esac
    return 0
}

# Секрет из менеджера паролей: значение ровно вида $(pass show <путь>) заменяется первой строкой записи
# (по соглашению pass там пароль, дальше login: и прочие поля). Вызов pass идёт напрямую, без eval:
# любое другое значение, в том числе с иным $(...), берётся литералом и не исполняется.
resolve_env_secret() {
    local key="$1" value="$2" re='^\$\(pass show ([A-Za-z0-9_./][A-Za-z0-9_./-]*)\)$'
    if [[ "$value" =~ $re ]]; then
        pass show "${BASH_REMATCH[1]}" | head -n1 || true
        return 0
    fi
    if [[ "$value" == *'$('* ]]; then
        echo "ПРЕДУПРЕЖДЕНИЕ: $key: подвыражение \$(...) не в поддержанной форме \$(pass show <путь>), значение взято как есть" >&2
    fi
    printf '%s' "$value"
}

# Функции для цветного вывода
print_error() { echo -e "${RED}$@${NC}"; }
print_success() { echo -e "${GREEN}$@${NC}"; }
print_warning() { echo -e "${YELLOW}$@${NC}"; }
print_info() { echo -e "${CYAN}$@${NC}"; }
print_header() { echo -e "${MAGENTA}$@${NC}"; }
print_variable() { echo -e "${GRAY}$@${NC}"; }

# Показать help
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo ""
    print_header "======================================"
    print_header "🚀 Claude Code Launcher"
    print_header "======================================"
    echo ""
    echo "Использование: ./run-claude.sh [аргументы для Claude]"
    echo ""
    echo "Скрипт выполняет:"
    echo "  1. Загружает переменные из .env файла"
    echo "  2. Загружает системный промпт из system-prompt.md"
    echo "  3. Запускает Claude Code с заданными параметрами"
    echo ""
    echo "Переменные окружения (.env):"
    echo "  LOAD_SYSTEM_PROMPT       - загружать системный промпт (true/false, по умолчанию: true)"
    echo "  CLAUDE_ARGS              - дефолтные аргументы для Claude"
    echo ""
    echo "MCP-серверы регистрируются отдельно и разово: ./register-http-mcp.sh (HTTP) или .mcp.json (stdio)"
    echo ""
    echo "Примеры:"
    echo "  ./run-claude.sh"
    echo "  ./run-claude.sh /init"
    echo "  ./run-claude.sh --model opus"
    echo ""
    exit 0
fi

# Проверка установки Claude CLI
if ! command -v claude &> /dev/null; then
    print_error "❌ ОШИБКА: Claude CLI не установлен!"
    print_error "Установите Claude Code: https://claude.ai/code"
    exit 1
fi

# Проверка наличия .env
if [ ! -f ".env" ]; then
    print_error "❌ ОШИБКА: Файл .env не найден!"
    print_error "Создайте файл .env на основе sample.env"
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

        # Те же срезы, что у register-http-mcp.sh: пробелы по краям и обрамляющие кавычки
        key="$(printf '%s' "$key" | tr -d '[:space:]')"
        value="$(trim_env_value "$value")"

        # Пропускаем, если ключ пустой
        [[ -z "$key" ]] && continue

        # Имя, меняющее поведение процессов (BASH_ENV, PATH, GIT_CONFIG_* ...), отбрасываем до вызова pass
        env_key_allowed "$key" || continue

        # Секреты тянем из pass, а не храним в открытом виде (например:
        # ES_API_KEY=$(pass show mdm/elastic-mcp-api-key)); поддержана только эта форма
        value=$(resolve_env_secret "$key" "$value")

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

# Проверяем значение LOAD_SYSTEM_PROMPT (по умолчанию true)
if [ "${LOAD_SYSTEM_PROMPT:-true}" = "true" ]; then
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
else
    print_warning "  ⏭️  Загрузка системного промпта отключена (LOAD_SYSTEM_PROMPT=false)"
fi

print_header ""
print_header "======================================"
print_header "🚀 Запуск Claude Code"
print_header "======================================"
print_header ""

cd .. || {
    print_error "❌ ОШИБКА: Не удалось перейти в родительскую директорию"
    exit 1
}

# Подготавливаем массив аргументов для безопасного вызова
CLAUDE_CMD_ARGS=()

# Добавляем CLAUDE_ARGS в массив (если есть)
if [ -n "$CLAUDE_ARGS" ]; then
    # Разбиваем CLAUDE_ARGS на отдельные элементы массива
    read -ra ARG_ARRAY <<< "$CLAUDE_ARGS"
    CLAUDE_CMD_ARGS+=("${ARG_ARRAY[@]}")
    print_variable "  🔧 Дефолтные аргументы: $CLAUDE_ARGS"
fi

# Добавляем системный промпт через --append-system-prompt (если есть)
if [ -n "$SYSTEM_PROMPT_TEXT" ]; then
    CLAUDE_CMD_ARGS+=("--append-system-prompt" "$SYSTEM_PROMPT_TEXT")
    print_info "  📌 Применяем кастомный системный промпт"
fi

# Добавляем пользовательские аргументы
CLAUDE_CMD_ARGS+=("$@")

if [ ${#CLAUDE_CMD_ARGS[@]} -gt 0 ]; then
    echo ""
fi

# Безопасный запуск Claude без eval
claude "${CLAUDE_CMD_ARGS[@]}"

echo ""
read -p "Нажмите Enter для выхода..."
