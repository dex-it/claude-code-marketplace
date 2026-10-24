## Симптом
Сервис notifier после деплоя не стартует, код возврата 78.

## Причина
В окружении сервиса не задана обязательная переменная `SMTP_RELAY`. Скрипт проверяет её в `/work/notifier/notifier.sh:6-9` и при пустом значении завершается с `exit 78`. В `/work/notifier/notifier.env` ключа `SMTP_RELAY` нет, только `NOTIFIER_QUEUE` и `NOTIFIER_RETRIES`. Вероятно, при деплое ключ потерялся.

## Улики
`docker exec diag46-n0-g2 sh -c 'cat /work/notifier/logs/notifier.log'`
```
2026-10-20T05:32:08Z INFO notifier starting
2026-10-20T05:32:08Z WARN optional dir /work/notifier/extra.d not found, skipping
2026-10-20T05:32:08Z ERROR SMTP_RELAY is not set
```
`docker exec diag46-n0-g2 sh -c 'cat -n /work/notifier/notifier.sh'`
```
     6	if [ -z "$SMTP_RELAY" ]; then
     7	  echo "... ERROR SMTP_RELAY is not set" >> "$LOG"
     8	  exit 78
```
`docker exec diag46-n0-g2 sh -c 'cat -n /work/notifier/notifier.env'`
```
     2	NOTIFIER_QUEUE=orders
     3	NOTIFIER_RETRIES=3
```
Предупреждение про `/work/notifier/extra.d` не связано с падением. Каталог необязательный (скрипт пишет "optional ... skipping" и продолжает работу), а ошибка идёт строкой ниже.

## Что предлагаю
Добавить в `/work/notifier/notifier.env` строку `SMTP_RELAY=<хост[:порт] почтового релея>`. Значение взять из конфигурации предыдущего релиза или у владельцев сервиса, я его не знаю. Затем перезапустить сервис и убедиться, что в логе появилась строка `INFO relay=...`. Убедиться, что деплой-процесс подхватывает `notifier.env`, и добавить в него проверку наличия обязательных ключей. Код и конфигурацию я не менял.

Примечание: файлов дисциплины команды в `.../n0-g2/discipline` и в lab не нашлось (каталоги пусты), поэтому отчёт составлен по формату из задания.
