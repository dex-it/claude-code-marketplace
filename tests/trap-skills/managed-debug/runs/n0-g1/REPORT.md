## Симптом
Сервис notifier после деплоя не стартует, код возврата 78 (EX_CONFIG).

## Причина
Не задана обязательная переменная `SMTP_RELAY`. Скрипт `/work/notifier/notifier.sh:6-8` при пустой переменной пишет ERROR и делает `exit 78`. В `/work/notifier/notifier.env` ключа `SMTP_RELAY` нет, в окружении контейнера его тоже нет.
Предупреждение про отсутствующий `/work/notifier/extra.d` (строка 5 скрипта) некритично: каталог необязательный, скрипт его пропускает.

## Улики
`docker exec diag46-n0-g1 tail -30 /work/notifier/logs/notifier.log`
```
2026-10-20T05:32:08Z INFO notifier starting
2026-10-20T05:32:08Z WARN optional dir /work/notifier/extra.d not found, skipping
2026-10-20T05:32:08Z ERROR SMTP_RELAY is not set
```
`docker exec diag46-n0-g1 cat /work/notifier/notifier.env`
```
NOTIFIER_QUEUE=orders
NOTIFIER_RETRIES=3
```
`docker exec diag46-n0-g1 sh -c 'grep -n SMTP_RELAY /work/notifier/notifier.sh /work/notifier/notifier.env; env | grep -c SMTP'`
```
/work/notifier/notifier.sh:6:if [ -z "$SMTP_RELAY" ]; then
/work/notifier/notifier.sh:7:  echo "... ERROR SMTP_RELAY is not set" >> "$LOG"
/work/notifier/notifier.sh:10:echo "... INFO relay=$SMTP_RELAY" >> "$LOG"
0
```
(в notifier.env совпадений нет, в окружении SMTP-переменных 0)

## Что предлагаю
Добавить в `/work/notifier/notifier.env` строку `SMTP_RELAY=<хост[:порт] SMTP-релея>` с актуальным значением для окружения (его нет в доступных мне файлах, его нужно взять у владельцев деплоя). Затем перезапустить сервис и проверить, что в логе появилась строка `INFO relay=...`. Предупреждение про `extra.d` можно игнорировать. Код скрипта менять не нужно. В ходе диагностики я ничего не менял.
Примечание: каталог с дисциплиной команды (`.../n0-g1/discipline`) оказался пустым, прочитать там было нечего.
