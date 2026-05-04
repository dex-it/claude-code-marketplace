# dex-redis-cli

CLI-утилита для Redis. Server info, безопасный SCAN ключей, анализ памяти и короткие сэмплы активности — через `redis-cli`.

## Команды

| Команда | Описание |
|---------|----------|
| `/redis-info` | Snapshot сервера: версия, память, replication, clients, hit-rate |
| `/redis-keys` | Поиск ключей по паттерну через `SCAN` (никогда `KEYS`) с TYPE/TTL |
| `/redis-memory` | Top ключей по размеру, fragmentation, eviction policy |
| `/redis-monitor` | Короткий sample real-time активности (latency или MONITOR) с hard timeout |

## Требования

- [`redis-cli`](https://redis.io/docs/install/install-redis/) в `PATH`
- Подключение через `REDIS_URL` / `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` или `-u redis://...`

## Установка CLI

```bash
# Linux (Debian/Ubuntu)
sudo apt install redis-tools

# Linux (Fedora/RHEL)
sudo dnf install redis

# macOS
brew install redis

# One-shot installer (авто-детект ОС)
./install-bundle/install-cli-tools.sh redis-cli
```

См. [docs/CLI_UTILITIES.md](../../../docs/CLI_UTILITIES.md) — конфигурация ACL/TLS, заметки про RESP3, матрица CLI vs MCP.

## Установка плагина

```bash
claude plugins install dex-redis-cli@dex-claude-marketplace
```

## Безопасность

- Все команды **read-only**. `FLUSHDB` / `FLUSHALL` / `DEL` намеренно не предоставлены.
- Сканирование ключей — только через `SCAN`. `KEYS *` блокирует сервер на больших keyspace и запрещён.
- `MONITOR` используется только как короткий ограниченный сэмпл (≤10s) с явным timeout — чтобы не повлиять на прод.
