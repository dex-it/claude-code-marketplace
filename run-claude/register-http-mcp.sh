#!/usr/bin/env bash
# Регистрация HTTP MCP-серверов (Confluence, Jira, произвольный) в Claude Code.
# Вынесено из run-claude/run-claude.sh: регистрация - разовая операция, лаунчер делал её на каждый запуск.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# По умолчанию user: CONFLUENCE_MCP_* и JIRA_MCP_* объявлены глобальными (README.md),
# запись в ~/.claude.json не зависит от рабочего каталога и не кладёт токен внутрь репозитория.
SCOPE="user"
ENV_FILE=""
AUTH_SCHEME="Token"
FORCE=0
DRY_RUN=0
ONE_NAME=""
ONE_URL=""
ONE_TOKEN=""

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

usage() {
    cat <<'EOF'
Использование: ./register-http-mcp.sh [опции]

Регистрирует HTTP MCP-серверы командой `claude mcp add --transport http` с заголовком Authorization.

Без опций --name/--url берёт пары переменных окружения:
  conflu <- CONFLUENCE_MCP_URL + CONFLUENCE_MCP_TOKEN
  jira   <- JIRA_MCP_URL + JIRA_MCP_TOKEN
Пара, у которой задан только URL или только токен, считается ошибкой; полностью пустая - пропускается.

Значения берутся из окружения; если рядом со скриптом лежит .env, он подгружается автоматически.

Области конфигурации:
  user     запись в ~/.claude.json, видна во всех проектах, от рабочего каталога не зависит;
  project  запись в .mcp.json корня проекта (каталог над этим скриптом) - файл лежит внутри
           репозитория, добавьте .mcp.json в .gitignore проекта;
  local    приватная запись для этого проекта, тоже привязана к корню проекта.

Токен Claude Code хранит открытым текстом в любой области - в ~/.claude.json или в .mcp.json;
у project к этому добавляется то, что файл лежит внутри репозитория. Переданный через --token
он виден ещё и в списке процессов, поэтому надёжнее держать его в .env, в том числе
подвыражением вида TOKEN=$(pass show <путь>).

Опции:
  -s, --scope <local|user|project>  Область конфигурации (по умолчанию: user)
  -e, --env-file <path>             Взять переменные из этого файла вместо соседнего .env
      --name <name>                 Зарегистрировать один произвольный сервер под этим именем
      --url <url>                   URL произвольного сервера
      --token <token>               Токен произвольного сервера (без него заголовок не отправляется)
      --auth-scheme <scheme>        Схема в заголовке Authorization (по умолчанию: Token; часто Bearer)
  -f, --force                       Перерегистрировать серверы, которые уже есть
  -d, --dry-run                     Показать команды (токены скрыты) и выйти
  -h, --help                        Эта справка

Примеры:
  ./register-http-mcp.sh --scope project
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
    # Разбор строки тот же, что у лаунчера (run-claude.sh): trim_env_value, env_key_allowed и
    # resolve_env_secret - одинаковые функции, сверяются тестом tests/tools/run-claude-secret.test.sh.
    while IFS= read -r line || [ -n "$line" ]; do
        line="${line#"${line%%[![:space:]]*}"}"
        line="${line%"${line##*[![:space:]]}"}"
        case "$line" in ''|\#*) continue ;; esac
        case "$line" in *=*) ;; *) continue ;; esac
        key="$(printf '%s' "${line%%=*}" | tr -d '[:space:]')"
        value="$(trim_env_value "${line#*=}")"
        [ -n "$key" ] || continue
        # Имя, меняющее поведение процессов (BASH_ENV, PATH, GIT_CONFIG_* ...), отбрасываем до вызова pass
        env_key_allowed "$key" || continue
        # Секрет из менеджера паролей: SOME_TOKEN=$(pass show <путь>). Та же поддержанная форма
        # и тот же разбор, что у лаунчера: иное $(...) берётся литералом.
        value="$(resolve_env_secret "$key" "$value")"
        # Пустое значение пропускаем: оно затёрло бы переменную, заданную в окружении.
        if [ -z "$value" ]; then
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

# project и local привязаны к рабочему каталогу: claude mcp add пишет .mcp.json туда,
# откуда его позвали. Лаунчер стартует claude из корня проекта (run-claude.sh: cd ..),
# поэтому запись должна лечь там же, а не в run-claude/, откуда запускают этот скрипт.
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
if [ "$SCOPE" != "user" ]; then
    cd "$PROJECT_ROOT"
    if [ "$DRY_RUN" -eq 1 ]; then
        echo "Область $SCOPE: запись пошла бы в корень проекта $PROJECT_ROOT"
    elif [ "$SCOPE" = "project" ]; then
        echo "Область project: запись ляжет в $PROJECT_ROOT/.mcp.json"
        echo "ВНИМАНИЕ: файл лежит внутри репозитория и токен в нём открытым текстом - добавьте .mcp.json в .gitignore."
    else
        echo "Область local: запись привязана к проекту $PROJECT_ROOT"
    fi
fi

registered=0
failed=0
skipped=0

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

    # claude mcp get находит сервер в любой видимой области, а claude mcp remove работает
    # строго в своей: без сверки области --force падал бы на remove. Область берём из
    # строки "Scope:" вывода get; неузнанный формат считаем совпадением - это прежнее поведение.
    existing_scope=""
    if get_out="$(claude mcp get "$name" 2>/dev/null)"; then
        case "$get_out" in
            *"Scope: User config"*)    existing_scope="user" ;;
            *"Scope: Project config"*) existing_scope="project" ;;
            *"Scope: Local config"*)   existing_scope="local" ;;
            *)                         existing_scope="$SCOPE" ;;
        esac
    fi

    if [ -n "$existing_scope" ] && [ "$existing_scope" != "$SCOPE" ]; then
        echo "ОШИБКА: сервер '$name' уже зарегистрирован в области $existing_scope, а регистрируем в $SCOPE." >&2
        echo "        Уберите его командой: claude mcp remove $name --scope $existing_scope" >&2
        failed=$((failed + 1))
        continue
    fi

    if [ -n "$existing_scope" ]; then
        if [ "$FORCE" -eq 1 ]; then
            echo "Сервер '$name' уже зарегистрирован в области $SCOPE - удаляю перед перерегистрацией."
            if ! claude mcp remove "$name" --scope "$SCOPE"; then
                echo "ОШИБКА: не удалось удалить '$name' из области $SCOPE." >&2
                failed=$((failed + 1))
                continue
            fi
        else
            echo "Пропущен $name: уже зарегистрирован в области $SCOPE. Перерегистрация: --force." >&2
            skipped=$((skipped + 1))
            continue
        fi
    fi

    echo "Регистрируем $name: $url"
    if "${cmd[@]}"; then
        registered=$((registered + 1))
    else
        echo "ОШИБКА: регистрация '$name' не удалась." >&2
        failed=$((failed + 1))
    fi
done

if [ "$DRY_RUN" -eq 1 ]; then
    exit 0
fi

echo ""
echo "Зарегистрировано серверов: $registered (scope: $SCOPE)."
if [ "$skipped" -gt 0 ]; then
    echo "Пропущено (уже есть): $skipped."
fi
if [ "$failed" -gt 0 ]; then
    echo "С ошибкой: $failed."
fi
echo "Проверка: claude mcp list"

if [ "$failed" -gt 0 ] || [ "$skipped" -gt 0 ]; then
    exit 1
fi
