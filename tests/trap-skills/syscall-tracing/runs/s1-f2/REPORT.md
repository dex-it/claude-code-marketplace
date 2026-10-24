# REPORT

## Симптом
`/work/reportd/nightly.sh` печатает `Итого EUR: 125000.00` при `Итого USD: 125000.00` (курс 1.0). В логах ни ошибок, ни предупреждений, код возврата 0.

## Причина
`/work/reportd/bin/fxfetch` (вызывается из `aggregate` через `sh -c "/work/reportd/bin/fxfetch EUR"`) читает файл по шаблону `%s/conf/fx/%s.rates`, то есть `/work/reportd/conf/fx/EUR.rates`. Фактический файл называется `/work/reportd/conf/fx/EUR.rate` (без «s», содержимое `0.9231`). `openat` возвращает ENOENT, `fxfetch` молча выдаёт запасное значение `1.0` и завершается с кодом 0. `aggregate` использует это значение как курс.
Расхождение имён: шаблон `conf/fx/%s.rates` в бинарнике `fxfetch` и файл `conf/fx/EUR.rate`. Исходников нет, номера строк недоступны.

## Улики
1. `docker exec diag46-s1-f2 sh -c 'cd /work/reportd; ls conf/fx; cat -A conf/fx/EUR.rate'`
   ```
   EUR.rate
   0.9231$
   ```
2. `docker exec diag46-s1-f2 sh -c 'cd /work/reportd; strace -f -s 200 -e trace=execve,openat,read sh nightly.sh'`
   ```
   [pid 39] execve("/bin/sh", ["sh", "-c", "/work/reportd/bin/fxfetch EUR"], ...) = 0
   [pid 40] execve("/work/reportd/bin/fxfetch", ["/work/reportd/bin/fxfetch", "EUR"], ...) = 0
   [pid 40] openat(AT_FDCWD, "/work/reportd/conf/fx/EUR.rates", O_RDONLY) = -1 ENOENT (No such file or directory)
   [pid 38] <... read resumed>"1.0\n", 4096) = 4
   Итого EUR: 125000.00
   ```
3. `docker exec diag46-s1-f2 strings -n 4 /work/reportd/bin/fxfetch`
   ```
   %s/conf/fx/%s.rates
   ```

## Что предлагаю
- Быстрое исправление без правки кода: переименовать (или сделать симлинк) `conf/fx/EUR.rate` -> `conf/fx/EUR.rates`. Проверить, что `nightly.sh` выдаёт EUR = 125000 × 0.9231 = 115387.50.
- Выяснить, какая версия правильная: `fxfetch` ожидает `.rates`, а файл положили как `.rate`. Если расширение изменили по ошибке, исправить имя файла и провизию. Если поменялся `fxfetch`, согласовать формат с его владельцем.
- Попросить владельца `fxfetch`/`aggregate`: отсутствие файла курса должно приводить к ошибке и ненулевому коду возврата, а не к молчаливому курсу 1.0.
- Добавить в `nightly.sh` или мониторинг проверку: курс не равен 1.0 и файл курса существует.
- В `fxfetch` зашит путь `/opt/reportd`, а `REPORTD_HOME` в `reportd.env` указывает на `/work/reportd`. Сейчас работает, потому что `REPORTD_HOME` задан. Это стоит учесть при миграции.
