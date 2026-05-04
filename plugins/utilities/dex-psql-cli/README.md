# dex-psql-cli

CLI-утилита для PostgreSQL. Read-only запросы, инспекция схемы, планы запросов и диагностика locks — через `psql`.

## Команды

| Команда | Описание |
|---------|----------|
| `/psql-query` | Выполнить read-only SQL-запрос (только SELECT/EXPLAIN/SHOW) |
| `/psql-schema` | Структура таблицы / схемы: колонки, индексы, FK, размер |
| `/psql-explain` | План выполнения запроса с интерпретацией bottleneck'ов |
| `/psql-locks` | Активные сессии, blocking locks, slow queries |

## Требования

- [`psql`](https://www.postgresql.org/download/) (PostgreSQL client) в `PATH`
- Параметры подключения: env (`PGHOST` / `PGPORT` / `PGUSER` / `PGPASSWORD` / `PGDATABASE`) или `~/.pgpass`

## Установка CLI

```bash
# Linux (Debian/Ubuntu)
sudo apt install postgresql-client

# Linux (Fedora/RHEL)
sudo dnf install postgresql

# macOS
brew install libpq && brew link --force libpq

# One-shot installer (авто-детект ОС)
./install-bundle/install-cli-tools.sh psql
```

См. [docs/CLI_UTILITIES.md](../../../docs/CLI_UTILITIES.md) — полный гайд по конфигурации (URI vs env, `PGPASSFILE`, SSL, матрица CLI vs MCP).

## Установка плагина

```bash
claude plugins install dex-psql-cli@dex-claude-marketplace
```

## Безопасность

Все команды **read-only by design**. `/psql-query` и `/psql-explain` отвергают `INSERT` / `UPDATE` / `DELETE` / DDL / DCL — для write-операций используйте `dex-postgresql-specialist` или вызывайте `psql` напрямую.
