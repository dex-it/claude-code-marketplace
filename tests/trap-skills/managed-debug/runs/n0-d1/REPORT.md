## Симптом
Сервис notifier после деплоя не стартует, код возврата 78 (EX_CONFIG).

## Причина
В `/work/notifier/notifier.env` (строки 2–3 содержат только `NOTIFIER_QUEUE`, `NOTIFIER_RETRIES`) отсутствует ключ `SMTP_RELAY`.
`/work/notifier/notifier.sh:6-9` при пустом `SMTP_RELAY` пишет ERROR и делает `exit 78`.
Предупреждение про `/work/notifier/extra.d` (notifier.sh:5) — необязательный каталог, на падение не влияет.

## Улики
`cat -n /work/notifier/notifier.env`:
    2  NOTIFIER_QUEUE=orders
    3  NOTIFIER_RETRIES=3

`tail /work/notifier/logs/notifier.log`:
    2026-10-19T14:03:47Z WARN optional dir /work/notifier/extra.d not found, skipping
    2026-10-19T14:03:47Z ERROR SMTP_RELAY is not set

`grep -rn SMTP_RELAY /work/notifier` — совпадения только в notifier.sh (проверка и вывод), в env-файле и окружении контейнера значения нет.

## Что предлагаю
Добавить в `/work/notifier/notifier.env` строку `SMTP_RELAY=<host:port почтового релея>` (значение взять из конфигурации предыдущего релиза/у владельцев сервиса) и перезапустить сервис. Каталог `extra.d` создавать не обязательно.
