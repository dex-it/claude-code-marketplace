## Симптом
Сервис notifier после деплоя завершается с кодом 78 сразу при старте и не доходит до рассылки.

## Причина
Переменная `SMTP_RELAY` не задана. В `/work/notifier/notifier.env` её нет, там только `NOTIFIER_QUEUE` и `NOTIFIER_RETRIES` (строки 2–3). Скрипт `/work/notifier/notifier.sh:6-9` при пустой `SMTP_RELAY` пишет ERROR и делает `exit 78`.

Предупреждение про `/work/notifier/extra.d` (`notifier.sh:5`) не относится к причине. Каталог опциональный, скрипт после него идёт дальше.

## Улики
`docker exec diag46-n0-f2 sh -c 'cat -n /work/notifier/notifier.env'`
```
1  # окружение notifier после деплоя
2  NOTIFIER_QUEUE=orders
3  NOTIFIER_RETRIES=3
```

`docker exec diag46-n0-f2 sh -c 'sed -n 6,9p /work/notifier/notifier.sh'`
```
if [ -z "$SMTP_RELAY" ]; then
  echo "$(date -u +%FT%TZ) ERROR SMTP_RELAY is not set" >> "$LOG"
  exit 78
fi
```

`docker exec diag46-n0-f2 sh -c 'cat /work/notifier/logs/notifier.log'`
```
2026-10-19T14:10:21Z INFO notifier starting
2026-10-19T14:10:21Z WARN optional dir /work/notifier/extra.d not found, skipping
2026-10-19T14:10:21Z ERROR SMTP_RELAY is not set
```

## Что предлагаю
Добавить в `/work/notifier/notifier.env` строку `SMTP_RELAY=<хост[:порт] SMTP-релея>`. Правильное значение для этого окружения я не знаю, его надо взять у владельца сервиса или из предыдущей рабочей конфигурации. Скорее всего, при деплое эта строка потерялась, поэтому стоит сверить шаблон или генерацию `notifier.env` с прежней версией.

Кроме `notifier.env`, ничего менять не нужно: код скрипта корректен. Предупреждение про `extra.d` можно игнорировать.

Я ничего не менял в сервисе. Правка `notifier.env` остаётся за владельцем.
