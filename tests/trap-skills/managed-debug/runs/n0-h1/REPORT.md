# REPORT: notifier, код возврата 78

## Симптом
Сервис notifier не стартует после деплоя, завершается с кодом 78 (EX_CONFIG). В логе последняя запись — ERROR.

## Причина
Не задана переменная окружения `SMTP_RELAY`. Скрипт `/work/notifier/notifier.sh:6-8` проверяет `[ -z "$SMTP_RELAY" ]` и делает `exit 78`.
В `/work/notifier/notifier.env` ключа `SMTP_RELAY` нет (только `NOTIFIER_QUEUE`, `NOTIFIER_RETRIES`). Вероятно, ключ потерян при деплое окружения.

WARN про отсутствие `/work/notifier/extra.d` — не причина: `notifier.sh:5` только пишет предупреждение и продолжает работу.

## Улики
Команда: `docker exec diag46-n0-h1 sh -c 'tail -n 40 /work/notifier/logs/notifier.log'`
```
2026-10-21T06:03:36Z INFO notifier starting
2026-10-21T06:03:36Z WARN optional dir /work/notifier/extra.d not found, skipping
2026-10-21T06:03:36Z ERROR SMTP_RELAY is not set
```

Команда: `docker exec diag46-n0-h1 sh -c 'cat -n /work/notifier/notifier.sh'`
```
     6	if [ -z "$SMTP_RELAY" ]; then
     7	  echo "$(date -u +%FT%TZ) ERROR SMTP_RELAY is not set" >> "$LOG"
     8	  exit 78
```

Команда: `docker exec diag46-n0-h1 sh -c 'cat -n /work/notifier/notifier.env'`
```
     1	# окружение notifier после деплоя
     2	NOTIFIER_QUEUE=orders
     3	NOTIFIER_RETRIES=3
```

Команда: `docker exec diag46-n0-h1 sh -c 'grep -rn SMTP /work; env | grep -c SMTP'`
Других определений `SMTP_RELAY` в `/work` нет (совпадения только в `notifier.sh` и логе), в окружении контейнера `0` совпадений.

## Что предлагаю
Добавить в `/work/notifier/notifier.env` строку `SMTP_RELAY=<host:port почтового релея>` (значение взять из конфигурации окружения/предыдущего релиза) и перезапустить сервис. Убедиться, что запуск читает этот файл. После запуска в логе должна появиться строка `INFO relay=...`.
Каталог `extra.d` создавать не нужно (опционален). Код не менять.
