# Отчёт: stockd не обновляет счётчики

## Симптом
Процесс stockd (PID 11) жив, CPU 0%, все 3 потока в состоянии S. В /work/logs/stockd.log повторяется одна и та же строка `stock=100 ledger=0`. Главный поток печатает её раз в 2 с, а рабочие потоки счётчики не меняют.

## Причина
Взаимная блокировка (deadlock) из-за разного порядка захвата двух мьютексов, /work/src/deadlock.c:
- `reserve` (поток LWP 12): строка 14 берёт `inventory_lock`, строка 16 ждёт `ledger_lock`.
- `audit` (поток LWP 13): строка 28 берёт `ledger_lock`, строка 30 ждёт `inventory_lock`.

`usleep(1000)` между двумя захватами (строки 15 и 29) почти гарантирует, что оба потока успеют взять первый замок до попытки взять второй.

## Улики
Процесс запущен от пользователя `app`. Под root в контейнере без capabilities ptrace запрещён: `gdb -p`, `strace -p` и чтение /proc/11/{stack,syscall,maps} дают `Operation not permitted`. Подключение сработало от имени владельца процесса.

Команда: `docker exec diag46-n2-f2 sh -c 'su app -s /bin/sh -c "gdb -p 11 -batch -ex \"thread apply all bt\""'`
```
Thread 3 (LWP 13): #0 futex_wait (... futex_word=0xaaaabd480080 <inventory_lock>)
 #3 ___pthread_mutex_lock (mutex=0xaaaabd480080 <inventory_lock>)
 #4 audit (arg=0x0) at /tmp/src/native/deadlock.c:30
Thread 2 (LWP 12): #0 futex_wait (... futex_word=0xaaaabd4800b0 <ledger_lock>)
 #3 ___pthread_mutex_lock (mutex=0xaaaabd4800b0 <ledger_lock>)
 #4 reserve (arg=0x0) at /tmp/src/native/deadlock.c:16
Thread 1 (LWP 11): #0 __GI___nanosleep ... #3 main () at /tmp/src/native/deadlock.c:43
```

Команда: `gdb -p 11 -batch -ex "print inventory_lock.__data.__owner" -ex "print ledger_lock.__data.__owner" -ex "print stock" -ex "print ledger"` (под `app`)
```
$1 = 12   # inventory_lock держит reserve (LWP 12)
$2 = 13   # ledger_lock держит audit (LWP 13)
$3 = 100  # stock
$4 = 0    # ledger
```
Цикл ожидания: LWP 12 держит inventory и ждёт ledger; LWP 13 держит ledger и ждёт inventory.

Дополнительно (`/proc/11/task/*/wchan`, `stat`): все потоки спят, CPU не расходуют.

В трассе путь исходника `/tmp/src/native/deadlock.c`, номера строк совпадают с /work/src/deadlock.c.

## Что предлагаю
1. Ввести единый порядок захвата во всех потоках: сначала `inventory_lock`, затем `ledger_lock`. Для этого в `audit` поменять местами строки 28 и 30 (и порядок снятия).
2. Либо заменить два мьютекса одним, если инвариант `stock + ledger == 100` проверяется под общей блокировкой.
3. Для восстановления прямо сейчас перезапустить stockd. Состояние после перезапуска начнётся заново (`stock=100 ledger=0`).
4. В качестве защиты можно собирать с `pthread_mutex_timedlock` или проверять lock order в CI (helgrind / TSan).
5. Правки кода я не вносил.
