# Context7 MCP - Шпаргалка

## Установка

```bash
# Автоматическая установка (глобально по умолчанию)
./install-context7.sh

# С указанием scope
./install-context7.sh --scope user      # глобально (по умолчанию)
./install-context7.sh --scope local     # локально
./install-context7.sh --scope project   # для команды

# Справка
./install-context7.sh --help

# Ручная установка (глобально)
claude mcp add --transport stdio context7 --scope user -- npx -y @upstash/context7-mcp
```

## Управление

```bash
# Список серверов
claude mcp list

# Информация о context7
claude mcp get context7

# Удалить context7
claude mcp remove context7

# Переустановить
claude mcp remove context7 && \
  claude mcp add --transport stdio context7 -- npx -y @upstash/context7-mcp
```

## Проверка в Claude Code

```
/mcp                    # Статус всех MCP серверов
/doctor                 # Диагностика проблем
```

## Установка Node.js (если не установлен)

```bash
# NodeSource (рекомендуется)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Стандартный репозиторий
sudo apt install -y nodejs npm

# Проверка
node --version && npm --version && npx --version
```

## Переменные окружения

```bash
# Увеличить таймаут запуска MCP сервера (мс)
export MCP_TIMEOUT=30000

# Увеличить лимит токенов для ответов
export MAX_MCP_OUTPUT_TOKENS=50000

claude
```

## Области установки

```bash
# User (по умолчанию в install-context7.sh) - все проекты
--scope user         # рекомендуется

# Local - только текущий проект
--scope local

# Project - команда через git (.mcp.json)
--scope project
```

## Диагностика проблем

```bash
# Тест context7 вручную
npx -y @upstash/context7-mcp

# Проверка Node.js
which node && node --version

# Перезагрузка shell
source ~/.bashrc
```
