# Отчёт: notifier не стартует (код 78)

## Симптом
После деплоя `/work/notifier/notifier.sh` завершается с кодом 78 (EX_CONFIG).

## Причина
Переменная `SMTP_RELAY` не задана: в `/work/notifier/notifier.env` её нет (только `NOTIFIER_QUEUE` и `NOTIFIER_RETRIES`). Скрипт проверяет её в `notifier.sh:6` и выходит с `exit 78` в `notifier.sh:8`.
Предупреждение про отсутствующий `/work/notifier/extra.d` (`notifier.sh:5`) — необязательный каталог, на код возврата не влияет.

## Улики
`docker exec diag46-n0-c2 sh -c 'tail -n 30 /work/notifier/logs/notifier.log'`
```
2026-10-19T13:58:53Z INFO notifier starting
2026-10-19T13:58:53Z WARN optional dir /work/notifier/extra.d not found, skipping
2026-10-19T13:58:53Z ERROR SMTP_RELAY is not set
```
`docker exec diag46-n0-c2 sh -c 'cat -n /work/notifier/notifier.env'`
```
1  # окружение notifier после деплоя
2  NOTIFIER_QUEUE=orders
3  NOTIFIER_RETRIES=3
```
`docker exec diag46-n0-c2 sh -c 'sed -n 6,9p /work/notifier/notifier.sh'`
```
if [ -z "$SMTP_RELAY" ]; then
  ERROR ... SMTP_RELAY is not set
  exit 78
```

## Что предлагаю
Добавить в `/work/notifier/notifier.env` ключ `SMTP_RELAY=<хост:порт SMTP-релея>` (значение взять из настроек окружения до деплоя / у владельцев почтовой инфраструктуры) и перезапустить сервис. Код скрипта менять не нужно. Каталог `extra.d` создавать нужно только если он реально используется.
