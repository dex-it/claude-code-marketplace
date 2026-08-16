# Установка маркетплейс (если еще не установлен)

Скачиваем https://github.com/dex-it/claude-code-marketplace.git
Запускаем claude из папки claude-code-marketplace
1. Набираем /plugin
2. Add marketpace
3. Набираем . (текущая папка)
4. жмем Enter
После этого должен появится список плагинов для установки.
Такой способ позволит нам управлять плагинами прямо из клауде.

Подробно здесь https://code.claude.com/docs/en/plugins#add-marketplaces
PS Можно будет устанавливать прямо из гита, когда опубликуем репу.
1. /plugin
2. Add marketplace
3. dex-it/claude-code-marketplace
После этого claude сам скачает и утановит маркетплейс в папку (USER\.claude\plugins\marketplaces\)

# Локальный запуск Claude Code для проекта

Папка `run-claude` содержит шаблон для локального запуска Claude Code на Linux/Mac/Windows с предварительной загрузкой переменных окружения и системного промпта. MCP-серверы лаунчер не регистрирует - это разовая операция: HTTP-серверы (Confluence, Jira) ставит лежащий здесь же `register-http-mcp.sh` (Windows - `register-http-mcp.ps1`), stdio-серверы описываются в `.mcp.json` (см. [mcp/README.md](../mcp/README.md)).

**⚠️ Важно:** Эта папка должна быть **скопирована в каждый конкретный проект**, где вы используете Claude Code. Переменные окружения уникальны для каждого проекта.

## Установка в проект

### Шаг 1: Копирование шаблона в ваш проект

```bash
# Linux/Mac - в корне вашего проекта
cp -r claude-code-marketplace/run-claude ./

# Windows (PowerShell)
Copy-Item -Recurse claude-code-marketplace\run-claude .\

# Windows (CMD)
xcopy /E /I claude-code-marketplace\run-claude .\run-claude\
```

### Шаг 2: Подготовка конфигурации

Скопируйте файл шаблона в реальную конфигурацию:

```bash
# Linux/Mac
cd run-claude
cp sample.env .env

# Windows
cd run-claude
copy sample.env .env
```

### Шаг 3: Заполнение переменных окружения

Отредактируйте файл `.env` и добавьте API ключи и строки подключения **для вашего проекта**:

#### Глобальные переменные (общие для всех проектов)

```env
# HTTP MCP-серверы (регистрируются один раз: ./register-http-mcp.sh)
CONFLUENCE_MCP_URL=https://confluence.mcp.dex-it.ru
CONFLUENCE_MCP_TOKEN=<PAT>
JIRA_MCP_URL=https://jira.mcp.dex-it.ru
JIRA_MCP_TOKEN=<PAT>

# GitLab (может быть глобальным или специфичным для проекта)
GITLAB_TOKEN=glpat-xxxxxxxxxxxxx
```

#### Переменные проекта (уникальны для каждого проекта)

```env
# PostgreSQL база данных ДЛЯ ЭТОГО ПРОЕКТА
DATABASE_URL=postgresql://postgres:password@localhost:5432/my-run-claude-db

# Elasticsearch этого проекта (опционально)
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_API_KEY=xxxxxxxxxxxxx

# Seq логирование этого проекта (опционально)
SEQ_SERVER_URL=http://localhost:5341
SEQ_API_KEY=xxxxxxxxxxxxx

# MLflow для ML проектов (опционально)
MLFLOW_TRACKING_URI=http://localhost:5000

# Notion workspace для документации этого проекта (опционально)
NOTION_TOKEN=ntn-xxxxxxxxxxxxx
```

**📖 Получение токенов:** см. [CREDENTIALS.md](../CREDENTIALS.md) в корне репозитория

### Шаг 4: Запуск Claude Code

Выберите скрипт в зависимости от вашей операционной системы:

```bash
# Linux/Mac
cd run-claude
./run-claude.sh

# Windows (PowerShell - рекомендуется)
cd run-claude
.\run-claude.ps1

# Для помощи по использованию
./run-claude.sh --help
.\run-claude.ps1 --help
```

**💡 Примечание:** В Windows рекомендуется использовать PowerShell версию (`run-claude.ps1`), так как она поддерживает все функции, включая загрузку системного промпта из файла.

## Что делают скрипты запуска

Скрипты автоматизируют процесс запуска Claude Code для вашего проекта:

```
1️⃣  Проверка установки Claude CLI
    └─ Если Claude CLI не найден → выход с ошибкой

2️⃣  Проверка файла .env
    └─ Если .env не найден → выход с ошибкой

3️⃣  Загрузка переменных окружения
    └─ Читает все строки из .env
    └─ Парсит пары "ключ=значение"
    └─ Устанавливает их в текущую сессию
    └─ Выводит список установленных переменных

4️⃣  Загрузка системного промпта
    └─ Читает содержимое ./run-claude/system-prompt.md
    └─ Автоматически добавляет через --append-system-prompt
    └─ Если файл отсутствует → используется стандартный промпт

5️⃣  Запуск Claude Code
    └─ Команда: claude [CLAUDE_ARGS] [--append-system-prompt "..."] [пользовательские аргументы]
    └─ Все переменные окружения доступны для плагинов
    └─ Системный промпт применяется автоматически
```

Регистрации MCP-серверов в этой схеме нет: это разовый отдельный шаг, `./register-http-mcp.sh`.

## Структура файлов

```
run-claude/
├── run-claude.sh           # Скрипт запуска для Linux/Mac
├── run-claude.ps1          # Скрипт запуска для Windows (PowerShell)
├── register-http-mcp.sh    # Разовая регистрация HTTP MCP-серверов (Linux/Mac)
├── register-http-mcp.ps1   # То же для Windows
├── system-prompt.md        # Системный промпт (загружается автоматически)
├── .env                    # Переменные окружения ВАШЕГО ПРОЕКТА (НЕ коммитится!)
├── sample.env              # Шаблон переменных (для примера)
└── README.md               # Этот файл
```

## Переменные окружения

### Управление поведением скриптов

| Переменная | Описание | Значение по умолчанию |
|-----------|---------|----------------------|
| `LOAD_SYSTEM_PROMPT` | Загружать системный промпт из system-prompt.md | `true` |

### Глобальные (для MCP серверов)

| Переменная | Описание | Область видимости |
|-----------|---------|------------------|
| `CONFLUENCE_MCP_URL` | URL сервера Confluence MCP (оставить пусто, если не используется) | Глобальная |
| `CONFLUENCE_MCP_TOKEN` | Personal Access Token для Confluence | Глобальная (единая для всех проектов) |
| `JIRA_MCP_URL` | URL сервера Jira MCP (оставить пусто, если не используется) | Глобальная |
| `JIRA_MCP_TOKEN` | Personal Access Token для Jira | Глобальная (единая для всех проектов) |

Лаунчер эти переменные только экспортирует. Регистрация серверов - `./register-http-mcp.sh` из этой папки, разово; полный набор опций - `./register-http-mcp.sh --help` и [mcp/README.md](../mcp/README.md).

### Специфичные для проекта

| Переменная | Описание | Плагины | Где использовать |
|-----------|---------|---------|------------------|
| `DATABASE_URL` | PostgreSQL connection string для этого проекта | dex-dotnet-developer | .env проекта |
| `ELASTICSEARCH_URL`, `ELASTICSEARCH_API_KEY` | Elasticsearch этого проекта | dex-dotnet-developer | .env проекта |
| `SEQ_SERVER_URL`, `SEQ_API_KEY` | Seq логирование этого проекта | dex-dotnet-developer | .env проекта |
| `GITLAB_TOKEN` | GitLab PAT (может быть общий или специфичный) | dex-dotnet-developer, dex-python-ml-developer, dex-devops | .env проекта |
| `NOTION_TOKEN` | Notion workspace этого проекта | dex-dotnet-developer, dex-product-manager | .env проекта |
| `MLFLOW_TRACKING_URI` | MLflow tracking server | dex-python-ml-developer | .env проекта |
| `WANDB_API_KEY` | Weights & Biases | dex-python-ml-developer | .env проекта |

## Изоляция переменных

### Почему переменные по проектам разные?

Каждый проект имеет свои:
- 🗄️ **Базы данных** — разные хосты, credentials, порты
- 🔍 **Elasticsearch индексы** — разные для разных проектов
- 📊 **Seq логирование** — разные serversи API ключи
- 📝 **Notion workspaces** — отдельные для каждого проекта
- 🤖 **MLflow tracking** — разные для разных экспериментов

### Глобальные переменные

Следующие переменные **обычно одинаковые** для всех проектов:
- `CONFLUENCE_MCP_TOKEN` — токен вашего Confluence
- `JIRA_MCP_TOKEN` — токен вашего Jira
- `GITLAB_TOKEN` — ваш GitLab PAT (если не специфичен для проекта)

**Совет:** Можно установить глобальные переменные в Windows или использовать `.env.local` в каждом проекте.

## Проверка конфигурации

Лаунчер MCP-серверы не регистрирует, поэтому проверка идёт после отдельного шага регистрации
(как он делается - в разделе [MCP серверы не подключены](#mcp-серверы-не-подключены)).

```bash
claude mcp list      # или /mcp внутри сессии
```

Пустой список после регистрации значит, что запись легла не в ту область или не в тот каталог:
`claude mcp get <имя>` печатает строку `Scope:` с фактической областью.

## Возможные проблемы

### Ошибка: "Файл .env не найден"

**Решение:** Скопируйте `sample.env` в `.env`:
```bash
# Linux/Mac
cp sample.env .env

# Windows
copy sample.env .env
```

### Переменные окружения не загружаются

**Решение:** Убедитесь что:
1. `.env` находится в папке `run-claude/`
2. Синтаксис в `.env` корректный: `KEY=VALUE` (без пробелов)
3. Нет пустых строк между парами
4. Файл закодирован как UTF-8

### MCP серверы не подключены

Лаунчер MCP-серверы не регистрирует - он только загружает переменные окружения и промпт. Регистрация делается отдельно и один раз:

```bash
# HTTP-серверы Confluence и Jira из соседнего .env
./register-http-mcp.sh

# stdio-серверы - записью из mcp/mcp-template.json в .mcp.json проекта
```

Проверка: `claude mcp list` (или `/mcp` внутри сессии). Сервер числится, но не подключается - смотрите `claude --mcp-debug` и раздел Troubleshooting в [mcp/README.md](../mcp/README.md).

### Разные базы данных для разных проектов

Если у вас несколько проектов с разными БД, убедитесь что каждый проект имеет свой `.env` с правильным `DATABASE_URL`.

## Best Practices

### ✅ Правильно

```
my-project/
├── run-claude/
│   ├── .env (DATABASE_URL=postgresql://...my-project-db)
│   ├── sample.env
│   ├── system-prompt.md
│   ├── run-claude.sh
│   ├── run-claude.ps1
│   ├── register-http-mcp.sh
│   └── register-http-mcp.ps1
├── src/
├── .gitignore (содержит run-claude/.env; при --scope project добавьте туда же .mcp.json)
└── ...
```

`.mcp.json` попадает в этот список только если регистрировали серверы с `--scope project`.
Токен Claude Code хранит открытым текстом в любой области; отличие `project` в том, что файл
с ним лежит внутри репозитория. Область по умолчанию (`user`) пишет в `~/.claude.json`.

### ❌ Неправильно

```
# НЕ используйте одну папку run-claude/ для всех проектов
# Каждый проект должен иметь свою копию с собственным .env
```

## Дальнейшие шаги

1. **Обновите плагины** в `~/.claude/plugins/` (если нужны новые роли)
2. **Установите дополнительные MCP серверы** в зависимости от ваших нужд
3. **Интегрируйте с IDE** (VS Code, Rider и др.)
4. **Читайте документацию плагинов** в `plugins/*/README.md`

## Полезные ссылки

- [Корневой README](../README.md) — всё про Claude Code Marketplace
- [CREDENTIALS.md](../CREDENTIALS.md) — детальное руководство по получению API ключей
- [Документация Claude Code](https://docs.claude.com) — официальная документация