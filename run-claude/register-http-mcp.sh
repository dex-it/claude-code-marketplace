#!/usr/bin/env bash
# Регистрация HTTP MCP-серверов (Confluence, Jira, произвольный) в Claude Code.
# Вынесено из run-claude/run-claude.sh: регистрация - разовая операция, лаунчер делал её на каждый запуск.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCOPE="project"
ENV_FILE=""
AUTH_SCHEME="Token"
FORCE=0
DRY_RUN=0
ONE_NAME=""
ONE_URL=""
ONE_TOKEN=""

usage() {
    cat <<'EOF'
Использование: ./register-http-mcp.sh [опции]

Регистрирует HTTP MCP-серверы командой `claude mcp add --transport http` с заголовком Authorization.

Без опций --name/--url берёт пары переменных окружения:
  conflu <- CONFLUENCE_MCP_URL + CONFLUENCE_MCP_TOKEN
  jira   <- JIRA_MCP_URL + JIRA_MCP_TOKEN
Пара, у которой задан только URL или только токен, считается ошибкой; полностью пустая - пропускается.

Значения берутся из окружения; если рядом со скриптом лежит .env, он подгружается автоматически.

Опции:
  -s, --scope <local|user|project>  Область конфигурации (по умолчанию: project)
  -e, --env-file <path>             Взять переменные из этого файла вместо соседнего .env
      --name <name>                 Зарегистрировать один произвольный сервер под этим именем
      --url <url>                   URL произвольного сервера
      --token <token>               Токен произвольного сервера (без него заголовок не отправляется)
      --auth-scheme <scheme>        Схема в заголовке Authorization (по умолчанию: Token; часто Bearer)
  -f, --force                       Перерегистрировать серверы, которые уже есть
  -d, --dry-run                     Показать команды (токены скрыты) и выйти
  -h, --help                        Эта справка

Примеры:
  ./register-http-mcp.sh --scope user
  ./register-http-mcp.sh --name gitlab --url https://gitlab.com/api/v4/mcp
  ./register-http-mcp.sh --name sentry --url https://mcp.sentry.dev/mcp --token "$SENTRY_TOKEN" --auth-scheme Bearer
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        -s|--scope)     SCOPE="${2:?--scope требует значение}"; shift 2 ;;
        -e|--env-file)  ENV_FILE="${2:?--env-file требует значение}"; shift 2 ;;
        --name)         ONE_NAME="${2:?--name требует значение}"; shift 2 ;;
        --url)          ONE_URL="${2:?--url требует значение}"; shift 2 ;;
        --token)        ONE_TOKEN="${2:?--token требует значение}"; shift 2 ;;
        --auth-scheme)  AUTH_SCHEME="${2:?--auth-scheme требует значение}"; shift 2 ;;
        -f|--force)     FORCE=1; shift ;;
        -d|--dry-run)   DRY_RUN=1; shift ;;
        -h|--help)      usage; exit 0 ;;
        *) echo "Неизвестная опция: $1" >&2; usage >&2; exit 2 ;;
    esac
done

case "$SCOPE" in
    local|user|project) ;;
    *) echo "ОШИБКА: --scope принимает local, user или project (получено: $SCOPE)" >&2; exit 2 ;;
esac

if ! command -v claude >/dev/null 2>&1; then
    echo "ОШИБКА: claude не найден в PATH." >&2
    exit 1
fi

if [ -z "$ENV_FILE" ] && [ -f "$SCRIPT_DIR/.env" ]; then
    ENV_FILE="$SCRIPT_DIR/.env"
fi

if [ -n "$ENV_FILE" ]; then
    if [ ! -f "$ENV_FILE" ]; then
        echo "ОШИБКА: файл не найден: $ENV_FILE" >&2
        exit 1
    fi
    echo "Переменные из: $ENV_FILE"
    while IFS= read -r line || [ -n "$line" ]; do
        line="${line#"${line%%[![:space:]]*}"}"
        case "$line" in ''|\#*) continue ;; esac
        case "$line" in *=*) ;; *) continue ;; esac
        key="$(printf '%s' "${line%%=*}" | tr -d '[:space:]')"
        value="${line#*=}"
        # Пустое значение пропускаем: оно затёрло бы переменную, заданную в окружении.
        if [ -z "$key" ] || [ -z "$value" ]; then
            continue
        fi
        export "$key=$value"
    done < "$ENV_FILE"
fi

targets=()

if [ -n "$ONE_NAME" ] || [ -n "$ONE_URL" ]; then
    if [ -z "$ONE_NAME" ] || [ -z "$ONE_URL" ]; then
        echo "ОШИБКА: --name и --url задаются вместе." >&2
        exit 2
    fi
    targets+=("$ONE_NAME|$ONE_URL|$ONE_TOKEN")
else
    for pair in "conflu:CONFLUENCE_MCP" "jira:JIRA_MCP"; do
        name="${pair%%:*}"
        prefix="${pair#*:}"
        url_var="${prefix}_URL"
        token_var="${prefix}_TOKEN"
        url="${!url_var:-}"
        token="${!token_var:-}"

        if [ -z "$url" ] && [ -z "$token" ]; then
            echo "Пропущен $name: $url_var и $token_var не заданы."
            continue
        fi
        if [ -z "$url" ]; then
            echo "ОШИБКА: $name - задан $token_var, но не $url_var." >&2
            exit 1
        fi
        if [ -z "$token" ]; then
            echo "ОШИБКА: $name - задан $url_var, но не $token_var." >&2
            exit 1
        fi
        targets+=("$name|$url|$token")
    done
fi

if [ "${#targets[@]}" -eq 0 ]; then
    echo "Нечего регистрировать: ни одной пары URL + токен. Подробности - ./register-http-mcp.sh --help" >&2
    exit 1
fi

registered=0

for target in "${targets[@]}"; do
    name="${target%%|*}"
    rest="${target#*|}"
    url="${rest%%|*}"
    token="${rest#*|}"

    cmd=(claude mcp add --transport http "$name" --scope "$SCOPE" "$url")
    if [ -n "$token" ]; then
        cmd+=(--header "Authorization: $AUTH_SCHEME $token")
    fi

    if [ "$DRY_RUN" -eq 1 ]; then
        if [ -n "$token" ]; then
            echo "claude mcp add --transport http $name --scope $SCOPE $url --header \"Authorization: $AUTH_SCHEME ***\""
        else
            echo "claude mcp add --transport http $name --scope $SCOPE $url"
        fi
        continue
    fi

    if claude mcp get "$name" >/dev/null 2>&1; then
        if [ "$FORCE" -eq 1 ]; then
            echo "Сервер '$name' уже зарегистрирован - удаляю перед перерегистрацией."
            claude mcp remove "$name" --scope "$SCOPE"
        else
            echo "ОШИБКА: сервер '$name' уже зарегистрирован. Перерегистрация: --force." >&2
            exit 1
        fi
    fi

    echo "Регистрируем $name: $url"
    "${cmd[@]}"
    registered=$((registered + 1))
done

if [ "$DRY_RUN" -eq 1 ]; then
    exit 0
fi

echo ""
echo "Зарегистрировано серверов: $registered (scope: $SCOPE)."
echo "Проверка: claude mcp list"
