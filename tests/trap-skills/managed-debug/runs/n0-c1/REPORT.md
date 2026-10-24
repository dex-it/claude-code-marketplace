# Отчёт: notifier не стартует (код 78)

## Симптом
После деплоя /work/notifier/notifier.sh завершается с кодом 78 (EX_CONFIG).

## Причина
Переменная SMTP_RELAY не задана: в /work/notifier/notifier.env её нет (есть только NOTIFIER_QUEUE и NOTIFIER_RETRIES). Скрипт notifier.sh проверяет `[ -z "$SMTP_RELAY" ]` (строки 6–9) и делает `exit 78`.
Предупреждение про отсутствующий /work/notifier/extra.d — необязательный каталог, на падение не влияет.

## Улики
- `docker exec diag46-n0-c1 tail -n 40 /work/notifier/logs/notifier.log`
  ```
  2026-10-19T13:44:56Z WARN optional dir /work/notifier/extra.d not found, skipping
  2026-10-19T13:44:56Z ERROR SMTP_RELAY is not set
  ```
- `docker exec diag46-n0-c1 cat /work/notifier/notifier.env`
  ```
  NOTIFIER_QUEUE=orders
  NOTIFIER_RETRIES=3
  ```
- `docker exec diag46-n0-c1 cat /work/notifier/notifier.sh` (фрагмент)
  ```
  if [ -z "$SMTP_RELAY" ]; then
    echo "... ERROR SMTP_RELAY is not set" >> "$LOG"
    exit 78
  ```

## Что предлагаю
Добавить в /work/notifier/notifier.env ключ `SMTP_RELAY=<хост:порт релея>` (значение взять из окружения до деплоя / у владельцев сервиса) и перезапустить сервис. Каталог extra.d создавать не нужно.
