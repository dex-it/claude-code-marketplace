# Симптом
Процесс `dotnet app/OrdersWorker.dll hang` (PID 11) жив, CPU 0%, но `processed` в /work/logs/worker.log застрял на 40, а `inflight` растёт (102 → 434 за 16 с), RSS медленно растёт.

# Причина
Thread pool starvation (sync-over-async): все 8 потоков пула, максимально разрешённых `ORDERS_MAX_WORKERS=8` (/work/orders-worker.env; применяется в /work/src/Program.cs:37-39 через `ThreadPool.SetMaxThreads(max, max)`), заблокированы в `Task.Wait()` внутри `Modes.Hang` (лямбда `Task.Run` вокруг `prices.GetPrice`, Program.cs:46-48). Ожидаемые вложенные задачи должны выполняться на том же пуле, свободных потоков нет, поэтому это взаимная блокировка. Новые задачи копятся в очереди.

# Улики
1. Лог (`tail /work/logs/worker.log`):
   `2s processed=40 inflight=102` … `16s processed=40 inflight=434`
2. Потоки процесса: `for t in /proc/11/task/*; do ... cat $t/comm, wchan` — 8 потоков `.NET TP Worker` все в `futex_wait`, процесс не использует CPU.
3. `dotnet-dump collect -p 11` и `dotnet-dump analyze d.dmp -c threadpool`:
   `Workers Total: 8  Workers Running: 8  Workers Idle: 0  Worker Max Limit: 8`
4. `dotnet-dump analyze d.dmp -c "setthread 8" -c clrstack` (одинаково для потоков пула 8, 14 и остальных):
   `System.Threading.Monitor.ObjWait` ← `Task.SpinThenBlockingWait` ← `Task.InternalWaitCore` ← `Modes+<>c__DisplayClass3_1.<Hang>b__0()` ← `Task<Decimal>.InnerInvoke`
5. `dumpheap -stat`: `584 System.Threading.Tasks.Task<System.Decimal>`, `584 Modes+<>c__DisplayClass3_1` — задачи накапливаются в очереди, но не выполняются.

# Что предлагаю
- Срочно: перезапустить сервис. Дамп /tmp/d.dmp в контейнере сохранить для разбора.
- Убрать блокирующее ожидание (`.Wait()`/`.Result`) в пути `GetPrice` и сделать цепочку `async`/`await` до конца. Это изменение кода, я его не вносил.
- Не занижать `ORDERS_MAX_WORKERS` и убрать жёсткий `SetMaxThreads`. Увеличение лимита лишь отодвинет проблему.
- Добавить алерт: `inflight` растёт при неизменном `processed`.
