# Симптом
/work/reportd/nightly.sh печатает «Итого EUR» равным «Итого USD» (курс 1.0); ошибок и предупреждений в логах нет.

# Причина
`bin/fxfetch` (его вызывает `bin/aggregate` через `popen("/work/reportd/bin/fxfetch EUR")`) читает курс из `$REPORTD_HOME/conf/fx/EUR.rates` (формат `%s/conf/fx/%s.rates`). В каталоге лежит файл `conf/fx/EUR.rate` (без «s», значение 0.9231). Файл `.rates` не найден, `fxfetch` молча отдаёт курс по умолчанию 1.0 и не пишет ошибку. Исходников нет, поэтому строка пути взята из `strings` и `strace` (номера строк неприменимы). Путь по умолчанию в бинарнике — `/opt/reportd`, которого нет, но `REPORTD_HOME` в `reportd.env` задан верно.

# Улики
$ docker exec diag46-s1-c2 sh -c 'ls /work/reportd/conf/fx; cat /work/reportd/conf/fx/EUR.rate'
EUR.rate
0.9231

$ strings -n4 /work/reportd/bin/fxfetch | grep conf
%s/conf/fx/%s.rates

$ strace -f -e trace=openat,execve /work/reportd/bin/aggregate   (REPORTD_HOME задан)
[pid 41] execve("/work/reportd/bin/fxfetch", ["/work/reportd/bin/fxfetch", "EUR"], ...) = 0
[pid 41] openat(AT_FDCWD, "/work/reportd/conf/fx/EUR.rates", O_RDONLY) = -1 ENOENT (No such file or directory)

$ sh /work/reportd/nightly.sh
Итого USD: 125000.00
Итого EUR: 125000.00

# Что предлагаю
- Переименовать `conf/fx/EUR.rate` в `conf/fx/EUR.rates` (или создать ссылку). Я ничего не менял.
- Содержимое файла `.rates` проверить после переименования: бинарник мог ожидать другой формат, чем одно число.
- Надолго: `fxfetch` должен завершаться с ошибкой и писать в stderr, если файла курса нет, вместо молчаливого 1.0. `aggregate` не должен считать итог при ошибке `fxfetch`.
- Добавить в `nightly.sh` проверку наличия `conf/fx/*.rates` перед запуском.
- Заметка: `nightly.sh` не исполняемый (нет бита x), прямой запуск даёт «Permission denied»; запускать через `sh`.
