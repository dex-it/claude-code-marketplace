## Симптом
notifier завершается с кодом 78 сразу после старта; в логе `/work/notifier/logs/notifier.log`:
`ERROR SMTP_RELAY is not set`.

## Причина
В `/work/notifier/notifier.env` после деплоя нет ключа `SMTP_RELAY`. Скрипт `/work/notifier/notifier.sh:6-9` проверяет `[ -z "$SMTP_RELAY" ]` и делает `exit 78`.
Предупреждение про отсутствующий `/work/notifier/extra.d` (notifier.sh:5) — необязательный каталог, к падению не относится.

## Улики
`docker exec diag46-n0-d2 tail -n 30 /work/notifier/logs/notifier.log`
```
2026-10-19T14:04:00Z INFO notifier starting
2026-10-19T14:04:00Z WARN optional dir /work/notifier/extra.d not found, skipping
2026-10-19T14:04:00Z ERROR SMTP_RELAY is not set
```
`docker exec diag46-n0-d2 cat -n /work/notifier/notifier.env`
```
1  # окружение notifier после деплоя
2  NOTIFIER_QUEUE=orders
3  NOTIFIER_RETRIES=3
```
`docker exec diag46-n0-d2 cat -n /work/notifier/notifier.sh` (строки 6-9):
```
6  if [ -z "$SMTP_RELAY" ]; then
7    echo "... ERROR SMTP_RELAY is not set" >> "$LOG"
8    exit 78
9  fi
```

## Что предлагаю
Добавить в `/work/notifier/notifier.env` ключ `SMTP_RELAY=<хост:порт SMTP-релея>` (значение взять из конфигурации предыдущего релиза/окружения) и убедиться, что env-файл подгружается при запуске. Добавить `SMTP_RELAY` в шаблон деплоя, чтобы ключ не терялся. `extra.d` создавать не нужно.
