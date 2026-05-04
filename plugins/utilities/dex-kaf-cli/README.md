# dex-kaf-cli

CLI-утилита для Kafka. Топики, consumer groups, tail сообщений и тестовая публикация — через [`kaf`](https://github.com/birdayz/kaf), single-binary Kafka-клиент с чистым UX.

## Команды

| Команда | Описание |
|---------|----------|
| `/kaf-topics` | Список / детали топиков: партиции, replication, retention, размер |
| `/kaf-groups` | Список consumer groups с lag и member assignments |
| `/kaf-consume` | Tail последних N сообщений топика для отладки |
| `/kaf-produce` | Отправить одно тестовое сообщение в топик |

## Требования

- [`kaf`](https://github.com/birdayz/kaf) в `PATH`
- Настроенный кластер в `~/.kaf/config` (`kaf config add-cluster <name>`, `kaf config select-cluster <name>`)

## Установка CLI

```bash
# macOS
brew tap birdayz/tap && brew install kaf

# Linux / macOS — official one-liner
curl https://raw.githubusercontent.com/birdayz/kaf/master/godownloader.sh | BINDIR=$HOME/.local/bin bash

# Go install (нужен Go toolchain)
go install github.com/birdayz/kaf/cmd/kaf@latest

# One-shot installer (авто-детект ОС)
./install-bundle/install-cli-tools.sh kaf
```

Настройка кластера:

```bash
kaf config add-cluster local --brokers localhost:9092
kaf config select-cluster local
kaf config use-cluster local   # или per-command --cluster local
```

См. [docs/CLI_UTILITIES.md](../../../docs/CLI_UTILITIES.md) — SASL/TLS, schema registry, матрица CLI vs MCP.

## Установка плагина

```bash
claude plugins install dex-kaf-cli@dex-claude-marketplace
```

## Безопасность

- Все read-команды (`/kaf-topics`, `/kaf-groups`, `/kaf-consume`) — non-mutating, используют временные consumer-groups, чтобы не влиять на committed-offsets продакшен-consumer'ов.
- `/kaf-produce` — только для диагностики единичными сообщениями; не для нагрузочного теста и не для записи прод-данных в shared-топики.
