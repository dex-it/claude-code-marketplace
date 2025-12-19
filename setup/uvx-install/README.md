# Установка uvx и PostgreSQL MCP для Claude Code

Установка разделена на два этапа:
1. **install.sh** — установка uv/uvx (платформа)
2. **install-postgres-mcp.sh** — установка PostgreSQL MCP сервера

## Что такое uv/uvx?

- **uv** — современный быстрый менеджер пакетов Python
- **uvx** — команда для запуска Python приложений (аналог pipx)
- **postgres-mcp** — MCP сервер для работы с PostgreSQL через Claude Code

## Быстрый старт

### Шаг 1: Установка платформы (uv/uvx)

```bash
cd setup/uvx-install
./install.sh
```

Скрипт автоматически:
- ✓ Проверит наличие uv и uvx
- ✓ Установит uv через официальный установщик
- ✓ Настроит PATH в ~/.bashrc или ~/.zshrc
- ✓ Создаст симлинк uvx

### Шаг 2: Установка MCP сервера

```bash
./install-postgres-mcp.sh
```

Скрипт автоматически:
- ✓ Проверит наличие uvx
- ✓ Предложит настроить DATABASE_URL
- ✓ Проверит доступность postgres-mcp
- ✓ Покажет инструкции по настройке MCP

## Ручная установка

### 1. Установка uv/uvx

```bash
# Установка uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Добавление в PATH
echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Создание симлинка uvx (если нужно)
ln -sf ~/.cargo/bin/uv ~/.cargo/bin/uvx
```

### 2. Проверка установки

```bash
uv --version
uvx --version
```

### 3. Настройка DATABASE_URL

```bash
# Добавьте в ~/.bashrc или ~/.zshrc
echo 'export DATABASE_URL="postgresql://user:password@host:port/database"' >> ~/.bashrc
source ~/.bashrc
```

### 4. Установка PostgreSQL MCP

```bash
# Через Claude CLI
claude mcp add --transport stdio postgres -- uvx postgres-mcp --access-mode=restricted

# Или вручную в .claude/mcp.json
{
  "mcpServers": {
    "postgres": {
      "command": "uvx",
      "args": ["postgres-mcp", "--access-mode=restricted"],
      "env": {
        "DATABASE_URI": "${DATABASE_URL}"
      }
    }
  }
}
```

## Проверка работы

### В командной строке

```bash
# Список MCP серверов
claude mcp list

# Информация о postgres
claude mcp get postgres

# Тестовый запуск
uvx postgres-mcp --help
```

### В Claude Code

```
/mcp
```

## Управление PostgreSQL MCP

### Удаление

```bash
claude mcp remove postgres
```

### Переустановка

```bash
claude mcp remove postgres
claude mcp add --transport stdio postgres -- uvx postgres-mcp --access-mode=restricted
```

## Настройка DATABASE_URL

### Формат строки подключения

```bash
postgresql://username:password@host:port/database
```

### Примеры

```bash
# Локальная БД
export DATABASE_URL="postgresql://postgres:password@localhost:5432/mydb"

# Удалённая БД
export DATABASE_URL="postgresql://user:pass@192.168.1.100:5432/production"

# С SSL
export DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
```

### Постоянная настройка

Добавьте в ~/.bashrc или ~/.zshrc:

```bash
# PostgreSQL MCP connection
export DATABASE_URL="postgresql://user:password@host:port/database"
```

## Решение проблем

### uvx не найден после установки

Перезапустите терминал или выполните:
```bash
source ~/.bashrc  # или ~/.zshrc
```

### Проверка PATH

```bash
echo $PATH | grep cargo
```

Должно содержать `~/.cargo/bin`

### Ручное добавление в PATH

```bash
echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### postgres-mcp не подключается

1. Проверьте DATABASE_URL:
   ```bash
   echo $DATABASE_URL
   ```

2. Проверьте подключение к БД:
   ```bash
   psql "$DATABASE_URL"
   ```

3. Проверьте логи Claude Code:
   ```
   /doctor
   ```

### Тестовый запуск postgres-mcp

```bash
# Установится автоматически при первом запуске
uvx postgres-mcp --help
```

## Режимы доступа

PostgreSQL MCP поддерживает режимы доступа:

- `--access-mode=restricted` — безопасный режим (рекомендуется)
- `--access-mode=full` — полный доступ (осторожно!)

```bash
# Безопасный режим
uvx postgres-mcp --access-mode=restricted

# Полный доступ
uvx postgres-mcp --access-mode=full
```

## Полезные ссылки

- [uv официальный сайт](https://github.com/astral-sh/uv)
- [uv документация](https://docs.astral.sh/uv/)
- [PostgreSQL MCP](https://github.com/modelcontextprotocol/servers/tree/main/src/postgres)
- [Claude Code MCP](https://code.claude.com/docs/en/mcp)

## Системные требования

- **ОС**: Ubuntu 24.04+ (любой Linux/macOS)
- **Python**: не требуется (uv управляет Python окружением)
- **PostgreSQL**: доступ к БД (локальной или удалённой)
- **Claude Code**: последняя версия
- **Интернет**: для загрузки пакетов

## Структура файлов

```
uvx-install/
├── install.sh              # Установка uv/uvx
├── install-postgres-mcp.sh # Установка PostgreSQL MCP
└── README.md               # Документация
```

## Примеры использования

### Установка в новой системе

```bash
# 1. Установка платформы
./install.sh

# 2. Установка MCP сервера
./install-postgres-mcp.sh

# 3. Настройка DATABASE_URL (если не настроили в install-postgres-mcp.sh)
echo 'export DATABASE_URL="postgresql://postgres:password@localhost:5432/mydb"' >> ~/.bashrc
source ~/.bashrc

# 4. Добавление MCP сервера
claude mcp add --transport stdio postgres -- uvx postgres-mcp --access-mode=restricted

# 5. Проверка
claude mcp list
```

### Быстрая установка с DATABASE_URL

```bash
# 1. Установка платформы
./install.sh

# 2. Настройка DATABASE_URL перед установкой MCP
export DATABASE_URL="postgresql://user:pass@host:5432/db"

# 3. Установка MCP (обнаружит DATABASE_URL автоматически)
./install-postgres-mcp.sh
```

### Изменение DATABASE_URL

```bash
# 1. Отредактируйте ~/.bashrc
nano ~/.bashrc

# 2. Найдите строку с DATABASE_URL и измените
export DATABASE_URL="postgresql://new_user:new_pass@new_host:5432/new_db"

# 3. Перезагрузите конфигурацию
source ~/.bashrc

# 4. Перезапустите Claude Code
```

## Безопасность

⚠️ **Важно:**

1. Не коммитьте DATABASE_URL в git
2. Используйте `--access-mode=restricted` для безопасности
3. Создайте отдельного пользователя БД с ограниченными правами
4. Используйте SSL для удалённых подключений

### Пример безопасного пользователя PostgreSQL

```sql
-- Создание пользователя с ограниченными правами
CREATE USER mcp_user WITH PASSWORD 'strong_password';

-- Права только на чтение
GRANT CONNECT ON DATABASE mydb TO mcp_user;
GRANT USAGE ON SCHEMA public TO mcp_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO mcp_user;

-- Строка подключения
-- postgresql://mcp_user:strong_password@localhost:5432/mydb
```
