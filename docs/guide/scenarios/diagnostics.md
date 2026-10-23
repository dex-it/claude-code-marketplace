---
title: Смотреть кластер, БД и очереди из чата
description: Команды над kubectl, psql, rabbitmqadmin, kaf и другими CLI для диагностики прямо из сессии Claude Code.
---

Вы диагностируете проблему и не хотите переключаться между терминалами: поды, запросы к базе, очереди - всё из одной сессии.

| | |
|---|---|
| **Ставлю** | бандл `cli-tools` |
| **Запускаю** | `/dex-kubectl-cli:kube-pods`, `/dex-psql-cli:psql-query`, `/dex-rabbitmqadmin-cli:rmq-queues` и другие |
| **Нужно** | сами программы (`kubectl`, `psql`, `rabbitmqadmin` и т.д.) на машине |

```bash
./install-bundle/install-bundle.sh cli-tools
./install-bundle/install-cli-tools.sh --check     # что из бинарей есть, чего не хватает
```

Плагины ставят только команды. Недостающие программы доставляет `install-cli-tools.sh`: `--all` ставит всё недостающее, а точечно - `./install-bundle/install-cli-tools.sh psql redis-cli`. На Windows - `install-cli-tools.ps1`.

## Примеры

```text
/dex-kubectl-cli:kube-pods -n payments --wide
/dex-psql-cli:psql-query "SELECT status, count(*) FROM orders GROUP BY status" --db shop
/dex-rabbitmqadmin-cli:rmq-queues
```

- `kube-pods` показывает таблицу подов: статус, рестарты, возраст, узел; с `--wide` ещё IP и ресурсы.
- `psql-query` выполняет **только чтение**: допустимы `SELECT`, `EXPLAIN`, `SHOW` и `WITH ... SELECT`. `INSERT`, `UPDATE`, `DELETE`, `DROP` и другие меняющие запросы отвергаются. Подключение берётся из переменных `PGHOST`, `PGUSER` и других либо из `~/.pgpass`; пароль в вывод не попадает.

Рядом лежат команды для GitHub и GitLab (`gh-runs`, `gl-pipelines`), Jenkins и TeamCity, Redis, Kafka, S3, Jira и Playwright: полный список с описаниями - в разделе [Утилиты](/catalog/utilities/).

## Дальше

- Руководство по установке бинарей, настройке и сравнению CLI с MCP: [CLI_UTILITIES.md на GitHub](https://github.com/dex-it/claude-code-marketplace/blob/main/docs/CLI_UTILITIES.md).
- Расследовать инцидент по уликам: [Разобрать инцидент на стенде](/scenarios/incident/).
