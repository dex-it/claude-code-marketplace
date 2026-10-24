## Симптом
Процесс stockd (PID 11) жив, CPU 0%, счётчики не меняются: в /work/logs/stockd.log повторяется `stock=100 ledger=0`. Печатает только главный поток, потоки с работой стоят.

## Причина
Взаимная блокировка (deadlock) из-за разного порядка захвата мьютексов в /work/src/deadlock.c:
- `reserve` (поток LWP 12): строка 14 берёт `inventory_lock`, строка 16 ждёт `ledger_lock`.
- `audit` (поток LWP 13): строка 28 берёт `ledger_lock`, строка 30 ждёт `inventory_lock`.

`usleep(1000)` между захватами (строки 15 и 29) почти гарантирует, что оба потока успеют взять по первой блокировке. Это нарушение порядка блокировок: инверсия порядка (ABBA).

## Улики
1. Состояние потоков (`docker exec diag46-n2-d1 sh -c 'ps -L -o pid,tid,stat,wchan:20,pcpu,comm -p 11'`):
```
11  11 Ssl - 0.0 stockd
11  12 Ssl - 0.0 stockd
11  13 Ssl - 0.0 stockd
```
Счётчики переключений контекста потоков 12 и 13 не менялись за 3 с (`voluntary_ctxt_switches: 2` оба раза), то есть они стоят заблокированными.

2. Стеки живого процесса. Из-под root gdb не подключается (`ptrace: Operation not permitted`), поэтому использовано `docker exec diag46-n2-d1 sh -c 'su app -s /bin/sh -c "gdb -p 11 -batch -ex \"thread apply all bt\""'` (владелец процесса — app):
```
Thread 3 (LWP 13): #0 futex_wait (expected=2, futex_word=... <inventory_lock>)
  #3 ___pthread_mutex_lock (mutex=... <inventory_lock>)
  #4 audit (arg=0x0) at /tmp/src/native/deadlock.c:30
Thread 2 (LWP 12): #0 futex_wait (expected=2, futex_word=... <ledger_lock>)
  #3 ___pthread_mutex_lock (mutex=... <ledger_lock>)
  #4 reserve (arg=0x0) at /tmp/src/native/deadlock.c:16
Thread 1 (LWP 11): __sleep -> main () at /tmp/src/native/deadlock.c:43
```
Путь /tmp/src/native/deadlock.c в отладочной информации — путь сборки; он соответствует /work/src/deadlock.c с теми же номерами строк.

3. Системные вызовы потоков (`su app ... cat /proc/11/task/{12,13}/syscall`):
```
98 0xaaaac86000b0 0x80 0x2 ...   (поток 12, futex на ledger_lock)
98 0xaaaac8600080 0x80 0x2 ...   (поток 13, futex на inventory_lock)
```
Номер 98 — futex на aarch64. Адреса совпадают с `ledger_lock` и `inventory_lock` из gdb. Каждый поток ждёт мьютекс, которым владеет другой.

## Что предлагаешь
1. Срочно: перезапустить stockd. Состояние в памяти (stock=100, ledger=0) не меняется, потери данных нет. Без исправления кода взаимная блокировка повторится.
2. Исправление кода (отдельная правка, не сделана): взять блокировки в одном порядке в обоих потоках, например `inventory_lock`, затем `ledger_lock`. В `audit` поменять местами строки 28 и 30. Либо использовать один общий мьютекс.
3. Профилактика: проверить сборку с ThreadSanitizer или Helgrind, которые находят инверсию порядка блокировок. Добавить в мониторинг алерт на отсутствие изменений счётчиков при живом процессе.
4. Для диагностики в контейнере: у root нет CAP_SYS_PTRACE, поэтому отладчик запускать от пользователя app.
