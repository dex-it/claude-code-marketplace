## Симптом
Процесс dotnet (PID 11, `OrdersWorker.dll hang`) жив, но в /work/logs/worker.log `processed=40` не растёт, а `inflight` линейно растёт (102 → 432 за 14 с), RSS ~31MB, CPU ~0%.

## Причина
Starvation пула потоков: лимит пула задан `ORDERS_MAX_WORKERS=8` (/work/orders-worker.env), применяется через `ThreadPool.SetMaxThreads(max, max)` (Program.cs:39). Все 8 рабочих потоков заблокированы в обработчике `Modes.Hang` на синхронном ожидании асинхронного вызова — sync-over-async `GetPriceAsync(sku).Result` (Program.cs:117). Продолжения этих async-вызовов тоже нужно исполнять в пуле, свободных потоков нет, поэтому ожидания никогда не завершаются (взаимоблокировка), а новые заказы копятся в очереди.

## Улики
1. `docker exec diag46-d1-c2 sh -c 'ps -eo pid,stat,nlwp,pcpu,rss,args | grep -i dotnet; tail /work/logs/worker.log'`
   `11 Ssl 19 0.9 32132 dotnet app/OrdersWorker.dll hang`
   `10s processed=40 inflight=291` / `16s processed=40 inflight=432`
2. `dotnet-dump collect -p 11` и `dotnet-dump analyze -c threadpool`:
   `Workers Total: 8  Workers Running: 8  Workers Idle: 0  Worker Max Limit: 8`; CPU utilization 0%.
3. `/proc/11/task/*/wchan`: все потоки `.NET TP Worker` в `futex_wait`.
4. `dotnet-dump analyze -c "setthread 8" -c clrstack` (аналогично поток 12 и остальные Threadpool Worker):
   `Monitor.ObjWait` ← `ManualResetEventSlim.Wait` ← `Task.InternalWaitCore` ← `Modes+<>c__DisplayClass3_1.<Hang>b__0()` ← `Task`1[Decimal].InnerInvoke` ← `ThreadPoolWorkQueue.Dispatch`
5. `-c syncblk`: монитор-блокировок нет (не lock-deadlock). Поток heartbeat исправно спит в `Thread.Sleep` (Program.cs:26) — поэтому лог идёт.

## Что предлагаю
- Исправление в коде (команде разработки): убрать `.Result`/`.Wait()` в `GetPrice` (Program.cs:117), использовать `await GetPriceAsync(sku)` по всей цепочке.
- Ослабить ограничение: поднять `ORDERS_MAX_WORKERS` (или не вызывать `SetMaxThreads`) — это лишь смягчение, не устранение.
- Сейчас: перезапуск процесса вернёт обработку, но без исправления проблема повторится. Добавить алерт на неменяющийся `processed` при растущем `inflight`.
