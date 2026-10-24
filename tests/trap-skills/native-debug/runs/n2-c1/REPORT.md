# Симптом
Процесс stockd (PID 11) жив, CPU 0%, но счётчики не меняются: в /work/logs/stockd.log все строки `stock=100 ledger=0` (с самого запуска, т.е. ни одной успешной итерации). Главный поток продолжает печатать строку каждые 2 с; два рабочих потока спят.

# Причина
Взаимная блокировка (deadlock) из-за разного порядка захвата мьютексов в /work/src/deadlock.c:
- `reserve` (поток TID 12): строка 14 `inventory_lock`, затем строка 16 `ledger_lock`;
- `audit` (поток TID 13): строка 28 `ledger_lock`, затем строка 30 `inventory_lock`.
`usleep(1000)` между захватами (строки 15 и 29) гарантирует, что каждый поток успевает взять первый замок до попытки второго, и оба навсегда ждут друг друга.

# Улики
Прямой стек/владельцев мьютексов получить не удалось: ptrace в контейнере запрещён (CapEff=0, Seccomp=2), gdb и strace не подключаются. Вывод опирается на наблюдение живого процесса через /proc плюс исходник.

`docker exec diag46-n2-c1 sh -c 'ps -L -o pid,tid,stat,pcpu,comm -p 11'`
```
PID TID STAT %CPU COMMAND
 11  11 Ssl  0.0 stockd
 11  12 Ssl  0.0 stockd
 11  13 Ssl  0.0 stockd
```
Все три потока спят, CPU 0.

`grep -E "^(State|voluntary|nonvoluntary)" /proc/11/task/<tid>/status` дважды с паузой 3 с:
```
TID 11 (main):  voluntary 12 -> 13   (живёт, просыпается из sleep(2))
TID 12:         voluntary 2  -> 2    nonvoluntary 0   (не меняется)
TID 13:         voluntary 2  -> 2    nonvoluntary 0   (не меняется)
```
Рабочие потоки сделали по 2 переключения (usleep + уход в ожидание на futex) и с тех пор не просыпались; utime/stime у обоих = 0.

`docker exec diag46-n2-c1 gdb -p 11 -batch ...` -> `ptrace: Operation not permitted.`
`docker exec diag46-n2-c1 strace -f -p 11` -> `PTRACE_SEIZE, 11: Operation not permitted`
Подтверждение блокировки на уровне стеков (`thread apply all bt`, владельцы мьютексов) не получено.

# Что предлагаю
1. Исправление в коде (вне рамок этой задачи, код не менялся): единый порядок захвата во всех потоках, например всегда `inventory_lock` -> `ledger_lock` (поменять строки 28/30 в `audit`), либо один общий замок.
2. Для оперативного восстановления: перезапустить stockd (состояние в памяти, на диск не пишется; счётчики стартуют с 100/0).
3. Для подтверждения стеком: выдать контейнеру `--cap-add=SYS_PTRACE` (или снять seccomp-ограничение) и снять `gdb -p <pid> -batch -ex "thread apply all bt"`; ожидаемо `reserve` ждёт в `pthread_mutex_lock` на строке 16, `audit` - на строке 30.
4. Профилактика: сборка с ThreadSanitizer / проверкой порядка блокировок в CI, `pthread_mutex_timedlock` или watchdog на прогресс счётчиков.
