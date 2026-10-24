# REPORT

## Симптом
Процесс stockd (PID 12) жив, CPU 0%, в /work/logs/stockd.log повторяется `stock=100 ledger=0` — счётчики не меняются (main-поток только печатает значения). Все три потока в состоянии S.

## Причина
Взаимная блокировка (deadlock) из-за разного порядка захвата мьютексов в /work/src/deadlock.c:
- `reserve` (строки 14→16): inventory_lock, затем ledger_lock;
- `audit` (строки 28→30): ledger_lock, затем inventory_lock.
Между двумя захватами стоит `usleep(1000)` (строки 15, 29), что делает гонку практически неизбежной. Каждый поток держит один замок и ждёт замок другого.
(gdb показывает путь /tmp/src/native/deadlock.c — это путь на момент сборки, номера строк совпадают с /work/src/deadlock.c.)

## Улики
Снимок живого процесса: `docker exec diag46-n2-d2 sh -c 'setpriv --reuid=1654 --regid=1654 --clear-groups gdb -p 12 -batch -ex "thread apply all bt" -ex "p inventory_lock" -ex "p ledger_lock"'`
(от root gdb/strace не подключаются: у процесса нет CAP_SYS_PTRACE, `ptrace: Operation not permitted`; процесс работает под uid 1654 (app), подключение под тем же uid работает.)
Фрагменты вывода:
- Thread 3 (LWP 14): `futex_wait (... futex_word=... <inventory_lock>)` ... `audit (arg=0x0) at .../deadlock.c:30`
- Thread 2 (LWP 13): `futex_wait (... futex_word=... <ledger_lock>)` ... `reserve (arg=0x0) at .../deadlock.c:16`
- Thread 1 (LWP 12): `__sleep` ← `main () at .../deadlock.c:43`
- `p inventory_lock` → `__lock = 2, __owner = 13`  (держит reserve, LWP 13)
- `p ledger_lock` → `__lock = 2, __owner = 14`  (держит audit, LWP 14)
Цикл ожидания: LWP 13 держит inventory и ждёт ledger; LWP 14 держит ledger и ждёт inventory.

## Что предлагаю
1. Исправить код: единый порядок захвата (всегда inventory_lock, затем ledger_lock) в `audit` (строки 28–30), либо один общий мьютекс; убрать `usleep` между захватами.
2. Восстановить сервис — перезапуск stockd (состояние только в памяти, stock=100 ledger=0 не теряется).
3. Для раннего обнаружения: watchdog/мониторинг неизменности счётчиков в логе; при необходимости pthread_mutex_timedlock или ошибочно-проверяющие (ERRORCHECK/robust) мьютексы с логированием.
4. Чтобы можно было диагностировать в контейнере от root: выдать CAP_SYS_PTRACE или подключаться под uid сервиса.
