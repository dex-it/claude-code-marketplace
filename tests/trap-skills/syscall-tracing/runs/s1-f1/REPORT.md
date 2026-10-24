# Отчёт: EUR = USD в nightly.sh

## Симптом
`/work/reportd/nightly.sh` печатает `Итого USD: 125000.00` и `Итого EUR: 125000.00` (курс 1.0). В логах ошибок и предупреждений нет, код возврата 0.

## Причина
`aggregate` вызывает `/work/reportd/bin/fxfetch EUR` через `sh -c`. `fxfetch` читает курс из `$REPORTD_HOME/conf/fx/<CUR>.rates` (формат `%s/conf/fx/%s.rates`, расширение **.rates**). В `conf/fx` лежит файл `EUR.rate` (без «s») со значением `0.9231`. Файл `EUR.rates` не найден (ENOENT), и `fxfetch` молча подставляет встроенный курс по умолчанию `1.0`, ничего не логируя.
Ключ и путь: `/work/reportd/conf/fx/EUR.rate` (должно быть `EUR.rates`). Строка формата зашита в бинарнике `bin/fxfetch`, исходников нет.

## Улики
1. Содержимое каталога конфигурации:
```
$ docker exec diag46-s1-f1 ls /work/reportd/conf/fx
EUR.rate          (содержимое: 0.9231)
```
2. Строки в бинарниках:
```
$ strings -n 4 bin/aggregate | grep fx
/work/reportd/bin/fxfetch EUR
$ strings -n 3 bin/fxfetch | grep -E "rates|1\.0"
%s/conf/fx/%s.rates
1.0
```
3. Трассировка вызова:
```
$ strace -f -s 200 -e trace=execve,openat,write sh nightly.sh
[pid 42] execve("/work/reportd/bin/fxfetch", ["/work/reportd/bin/fxfetch", "EUR"], ...) = 0
[pid 42] openat(AT_FDCWD, "/work/reportd/conf/fx/EUR.rates", O_RDONLY) = -1 ENOENT (No such file or directory)
[pid 42] write(1, "1.0\n", 4)        = 4
```
4. Прямой запуск: `./bin/fxfetch EUR` выводит `1.0`, код возврата 0.

## Что предлагаю
- Переименовать (или скопировать) `conf/fx/EUR.rate` в `conf/fx/EUR.rates`. Я ничего не менял, это правка конфигурации на стороне владельцев сервиса. После неё `fxfetch EUR` должен выдать `0.9231`, а EUR в отчёте станет примерно 115387.50.
- Проверить остальные валюты: все файлы курсов должны называться `<CUR>.rates`.
- Попросить автора `fxfetch` и `aggregate` не использовать молчаливый fallback на 1.0. При отсутствии файла курса нужно писать ошибку и завершаться с ненулевым кодом.
- В `nightly.sh` добавить проверку, что курс прочитан из файла, и не принимать курс ровно 1.0 для не-USD валюты.
