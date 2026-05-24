# dex-rabbitmqadmin-cli

CLI-утилита для RabbitMQ. Обзор кластера, статус очередей, bindings и тестовая публикация — через [`rabbitmqadmin-ng`](https://github.com/rabbitmq/rabbitmqadmin-ng) (новая Rust-версия `rabbitmqadmin` от команды RabbitMQ).

## Команды

| Команда | Описание |
|---------|----------|
| `/rmq-overview` | Снимок кластера: версия, ноды, message rates, сводка объектов |
| `/rmq-queues` | Список/детали очередей: messages, consumers, state, policy |
| `/rmq-bindings` | Карта routing'а: source → destination, routing keys |
| `/rmq-publish` | Опубликовать одно тестовое сообщение в exchange |

## Требования

- [`rabbitmqadmin`](https://github.com/rabbitmq/rabbitmqadmin-ng) (rabbitmqadmin-ng) в `PATH`
- HTTP API брокера должен быть доступен (плагин `rabbitmq_management` включён, по умолчанию порт 15672)
- Параметры подключения: `~/.rabbitmqadmin.conf` (профили) или флаги `--host` / `--port` / `--username` / `--password` / `--vhost`

## Установка CLI

```bash
# macOS — официальный tap RabbitMQ
brew tap rabbitmq/tap && brew install rabbitmqadmin

# Linux — go-style установка из github releases
# (см. https://github.com/rabbitmq/rabbitmqadmin-ng/releases для актуальной версии)
curl -fsSL -o /tmp/rabbitmqadmin "https://github.com/rabbitmq/rabbitmqadmin-ng/releases/latest/download/rabbitmqadmin-linux-x86_64"
sudo install -m 0755 /tmp/rabbitmqadmin /usr/local/bin/rabbitmqadmin

# One-shot installer (авто-детект ОС)
./install-bundle/install-cli-tools.sh rabbitmqadmin
```

Полный гайд по конфигурации (`~/.rabbitmqadmin.conf` профили, TLS, multi-cluster) и матрица CLI vs MCP — см. [docs/CLI_UTILITIES.md](../../../docs/CLI_UTILITIES.md).

## Установка плагина

```bash
claude plugins install dex-rabbitmqadmin-cli@dex-claude-marketplace
```

## Безопасность

- Все команды чтения (`/rmq-overview`, `/rmq-queues`, `/rmq-bindings`) — read-only.
- Деструктивные операции (`declare`, `delete`, `purge`, `import definitions`) намеренно **не** обёрнуты в slash-команды — выполняются вручную или через `dex-rabbitmq-specialist`.
- `/rmq-publish` пишет в реальный exchange — использовать только staging/test ресурсы, не прод.
