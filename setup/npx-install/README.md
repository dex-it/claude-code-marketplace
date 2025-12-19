# Установка npx и Context7 MCP для Claude Code

Установка разделена на два этапа:
1. **install.sh** — установка Node.js/npm/npx (платформа)
2. **install-context7.sh** — установка Context7 MCP сервера

## Что такое Context7?

**Context7** — это MCP сервер от Upstash, который автоматически подключает актуальную документацию разработчика к Claude Code.

## Быстрый старт

### Шаг 1: Установка платформы (Node.js/npm/npx)

```bash
cd setup/npx-install
./install.sh
```

Скрипт автоматически:
- ✓ Проверит наличие Node.js, npm, npx
- ✓ Предложит установку через NodeSource (LTS) или Ubuntu репозиторий
- ✓ Проверит корректность установки

### Шаг 2: Установка MCP сервера

```bash
# Глобальная установка (по умолчанию, для всех проектов)
./install-context7.sh

# Локальная установка (только текущий проект)
./install-context7.sh --scope local

# Проектная установка (для команды через .mcp.json)
./install-context7.sh --scope project
```

Скрипт автоматически:
- ✓ Проверит наличие npx
- ✓ Проверит доступность @upstash/context7-mcp
- ✓ Добавит Context7 в конфигурацию Claude MCP
- ✓ Проверит корректность установки

## Ручная установка

### 1. Установка Node.js

**Вариант A: NodeSource (рекомендуется)**
```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
apt-get install -y nodejs
```

**Вариант B: Ubuntu репозиторий**
```bash
apt-get update
apt-get install -y nodejs npm
```

### 2. Проверка установки

```bash
node --version
npm --version
npx --version
```

### 3. Установка Context7 MCP

```bash
# Глобальная установка (рекомендуется)
claude mcp add --transport stdio context7 --scope user -- npx -y @upstash/context7-mcp

# Локальная установка
claude mcp add --transport stdio context7 --scope local -- npx -y @upstash/context7-mcp

# Проектная установка
claude mcp add --transport stdio context7 --scope project -- npx -y @upstash/context7-mcp
```

⚠️ **Важно:** Двойной дефис `--` разделяет флаги Claude CLI от команды MCP сервера.

## Проверка работы

### В командной строке

```bash
# Список MCP серверов
claude mcp list

# Информация о context7
claude mcp get context7
```

### В Claude Code

```
/mcp
```

## Управление Context7

### Удаление

```bash
claude mcp remove context7
```

### Переустановка

```bash
claude mcp remove context7
claude mcp add --transport stdio context7 -- npx -y @upstash/context7-mcp
```

## Области установки (Scopes)

### user (по умолчанию)
- Доступен во всех проектах
- Рекомендуется для личного использования

### local
- Только текущий проект
- Не попадает в git

### project
- Для команды через .mcp.json
- Попадает в git

## Решение проблем

### Context7 не подключается

1. Проверьте Node.js:
   ```bash
   node --version
   ```

2. Запустите context7 вручную:
   ```bash
   npx -y @upstash/context7-mcp
   ```

3. Проверьте логи:
   ```
   /doctor
   ```

### "command not found"

Перезапустите терминал или выполните:
```bash
source ~/.bashrc
```

### Увеличение таймаута

```bash
export MCP_TIMEOUT=30000
claude
```

## Полезные ссылки

- [Context7 на MCP Market](https://mcpmarket.com/server/context7-http)
- [Документация Claude Code MCP](https://code.claude.com/docs/en/mcp)
- [MCP Servers на GitHub](https://github.com/modelcontextprotocol/servers)

## Системные требования

- **ОС**: Ubuntu 24.04+ (любой Linux/macOS)
- **Node.js**: v18.x+ (рекомендуется LTS)
- **Claude Code**: последняя версия
- **Интернет**: для загрузки пакетов

## Структура файлов

```
npx-install/
├── install.sh              # Установка Node.js/npm/npx
├── install-context7.sh     # Установка Context7 MCP
├── README.md               # Документация
├── cheatsheet.md           # Шпаргалка
└── CHANGELOG.md            # История изменений
```

## Примеры использования

### Установка в новой системе

```bash
# 1. Установка платформы
./install.sh

# 2. Установка MCP сервера глобально
./install-context7.sh

# 3. Проверка
claude mcp list
```

### Установка для проекта команды

```bash
# 1. Убедитесь, что npx установлен
./install.sh

# 2. Установка в project scope (попадёт в .mcp.json)
./install-context7.sh --scope project

# 3. Коммит .mcp.json в git
git add .claude/mcp.json
git commit -m "Add Context7 MCP server"
```
