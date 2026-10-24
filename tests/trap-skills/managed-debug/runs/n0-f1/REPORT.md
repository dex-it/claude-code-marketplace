## Симптом
Сервис notifier после деплоя не стартует, код возврата 78.

## Причина
Переменная `SMTP_RELAY` не задана. В `/work/notifier/notifier.env` её нет (строки 1–3: только `NOTIFIER_QUEUE`, `NOTIFIER_RETRIES`). `/work/notifier/notifier.sh:6-8` проверяет `[ -z "$SMTP_RELAY" ]`, пишет ERROR и делает `exit 78`.

## Улики
`docker exec diag46-n0-f1 sh -c 'cat -n /work/notifier/notifier.env'`
```
1  # окружение notifier после деплоя
2  NOTIFIER_QUEUE=orders
3  NOTIFIER_RETRIES=3
```
`docker exec diag46-n0-f1 sh -c 'sed -n 6,9p /work/notifier/notifier.sh'`
```
if [ -z "$SMTP_RELAY" ]; then
  echo "... ERROR SMTP_RELAY is not set" >> "$LOG"
  exit 78
fi
```
`docker exec diag46-n0-f1 sh -c 'tail -n 3 /work/notifier/logs/notifier.log'`
```
2026-10-19T14:10:19Z INFO notifier starting
2026-10-19T14:10:19Z WARN optional dir /work/notifier/extra.d not found, skipping
2026-10-19T14:10:19Z ERROR SMTP_RELAY is not set
```
Строка WARN про `extra.d` не причина: каталог необязательный (`notifier.sh:5`), скрипт идёт дальше. Падение вызывает только следующая за ней строка ERROR.

## Что предлагаю
Добавить в `/work/notifier/notifier.env` ключ `SMTP_RELAY=<host:port почтового релея>`. Значение нужно взять у владельцев почтовой инфраструктуры или из конфигурации до деплоя, я его не знаю. Потом перезапустить сервис. Ожидаемый признак успеха: в логе появится `INFO relay=...`. Убедиться также, что запуск действительно подгружает `notifier.env` в окружение процесса. Код скрипта менять не нужно. WARN про `extra.d` можно игнорировать.
