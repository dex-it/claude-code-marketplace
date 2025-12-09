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

Папка `run-claude` содержит шаблон для локального запуска Claude Code на Linux/Mac/Windows с предварительной загрузкой переменных окружения и подключением MCP серверов (Confluence, Jira).

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
# Confluence MCP сервер (оставить пусто, если не используется)
CONFLUENCE_MCP_URL=https://confluence.mcp.dex-it.ru
CONFLUENCE_MCP_TOKEN=<PAT>

# Jira MCP сервер (оставить пусто, если не используется)
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
NOTION_API_KEY=ntn-xxxxxxxxxxxxx
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

5️⃣  Регистрация MCP серверов (условная, только если URL заполнены)
    └─ Confluence MCP: регистрируется если CONFLUENCE_MCP_URL и CONFLUENCE_MCP_TOKEN заполнены
    └─ Jira MCP: регистрируется если JIRA_MCP_URL и JIRA_MCP_TOKEN заполнены
    └─ Если URL или токены пусты → выводится предупреждение

6️⃣  Запуск Claude Code
    └─ Команда: claude [CLAUDE_ARGS] [--append-system-prompt "..."] [пользовательские аргументы]
    └─ Все переменные окружения доступны для плагинов
    └─ Системный промпт применяется автоматически
```

## Структура файлов

```
run-claude/
├── run-claude.sh           # Скрипт запуска для Linux/Mac
├── run-claude.ps1          # Скрипт запуска для Windows (PowerShell)
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
| `CONFLUENCE_MCP_URL` | URL сервера Confluence MCP (оставить пусто для отключения) | Глобальная |
| `CONFLUENCE_MCP_TOKEN` | Personal Access Token для Confluence | Глобальная (единая для всех проектов) |
| `JIRA_MCP_URL` | URL сервера Jira MCP (оставить пусто для отключения) | Глобальная |
| `JIRA_MCP_TOKEN` | Personal Access Token для Jira | Глобальная (единая для всех проектов) |

### Специфичные для проекта

| Переменная | Описание | Плагины | Где использовать |
|-----------|---------|---------|------------------|
| `DATABASE_URL` | PostgreSQL connection string для этого проекта | dex-dotnet-developer | .env проекта |
| `ELASTICSEARCH_URL`, `ELASTICSEARCH_API_KEY` | Elasticsearch этого проекта | dex-dotnet-developer | .env проекта |
| `SEQ_SERVER_URL`, `SEQ_API_KEY` | Seq логирование этого проекта | dex-dotnet-developer | .env проекта |
| `GITLAB_TOKEN` | GitLab PAT (может быть общий или специфичный) | dex-dotnet-developer, dex-python-ml-developer, dex-devops | .env проекта |
| `NOTION_API_KEY` | Notion workspace этого проекта | dex-dotnet-developer, dex-product-manager | .env проекта |
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

После запуска Claude Code выполните:

```
/mcp list
```

Вы должны увидеть подключённые MCP серверы:
- ✅ Confluence MCP
- ✅ Jira MCP
- ✅ Другие MCP серверы ваших плагинов

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

### MCP серверы не регистрируются

Это нормально! Если вы видите предупреждения о пропуске MCP серверов:

**Если хотите использовать MCP:**
1. Заполните `CONFLUENCE_MCP_URL` и `JIRA_MCP_URL` в `.env`
2. Заполните соответствующие токены `CONFLUENCE_MCP_TOKEN` и `JIRA_MCP_TOKEN`
3. Перезапустите скрипт запуска

**Если НЕ хотите использовать MCP:**
- Оставьте URL пусто в `.env`, скрипт автоматически их пропустит

**Проверка доступности серверов:**
```bash
# Linux/Mac
curl -v -H "Authorization: Token $CONFLUENCE_MCP_TOKEN" $CONFLUENCE_MCP_URL/health

# Windows (PowerShell)
curl -v -H "Authorization: Token $env:CONFLUENCE_MCP_TOKEN" $env:CONFLUENCE_MCP_URL/health

# Windows (CMD)
curl -v -H "Authorization: Token %CONFLUENCE_MCP_TOKEN%" %CONFLUENCE_MCP_URL%/health
```

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
│   └── run-claude.ps1
├── src/
├── .gitignore (содержит run-claude/.env)
└── ...
```

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

- [Корневой README](../../README.md) — всё про Claude Code Marketplace
- [CREDENTIALS.md](../../CREDENTIALS.md) — детальное руководство по получению API ключей
- [Документация Claude Code](https://docs.claude.com) — официальная документация