# REPORT: orders-worker перестал обрабатывать заказы

## Симптом
Процесс `dotnet app/OrdersWorker.dll hang` (PID 11) жив, состояние S, CPU 0%. В /work/logs/worker.log `processed=40` не меняется, `inflight` растёт линейно (102 → 578 за 22 с), rss почти не меняется.

## Причина
Пул потоков исчерпан (starvation). Лимит пула 8 рабочих потоков: `ThreadPool.SetMaxThreads(max, max)`, где `max = ORDERS_MAX_WORKERS` (по умолчанию 8), /work/src/Program.cs:37-39. Каждая задача, запущенная через `Task.Run` (Program.cs:46-52), синхронно блокирует рабочий поток вызовом `GetPriceAsync(sku).Result` (`PriceClient.GetPrice`, Program.cs:117). Все 8 потоков заняты ожиданием `Task.Delay`-продолжений, которым нужен свободный поток пула. Свободных потоков нет, поэтому продолжения не выполняются. Это sync-over-async deadlock в пуле с жёстким потолком.
Значение `ORDERS_MAX_WORKERS` в окружении процесса не проверял: чтение /proc/11/environ было запрещено. Но живой пул показывает лимит 8.

## Улики
1. Поток-счётчик в логе: `tail /work/logs/worker.log`
   ```
   2s processed=40 inflight=102 rss=27MB
   ...
   22s processed=40 inflight=578 rss=29MB
   ```
2. Потоки процесса, `/proc/11/task/*/{comm,wchan}`: все 8 `.NET TP Worker` в `futex_wait`, процесс не в CPU.
3. `dotnet-dump collect -p 11 --type Full` и `dotnet-dump analyze /tmp/w.dmp -c threadpool`:
   ```
   CPU utilization:  0%
   Workers Total:    8
   Workers Running:  8
   Workers Idle:     0
   Worker Min Limit: 4
   Worker Max Limit: 8
   ```
4. `dotnet-dump analyze /tmp/w.dmp -c "clrstack -all"`: стек каждого из 8 потоков пула одинаков:
   ```
   System.Threading.Monitor.ObjWait(Int32, System.Object)
   System.Threading.ManualResetEventSlim.Wait(...)
   System.Threading.Tasks.Task.SpinThenBlockingWait(...)
   System.Threading.Tasks.Task.InternalWaitCore(...)
   Modes+<>c__DisplayClass3_1.<Hang>b__0()
   System.Threading.Tasks.Task`1[[System.Decimal...]].InnerInvoke()
   ...ThreadPoolWorkQueue.Dispatch()
   ```
   Это `Task.Wait/.Result` внутри делегата `Task.Run` из `Hang`. `syncblk` пуст, то есть это не монитор, а ожидание Task.
5. Главный поток (OS 0xb) в `Modes.Hang()` → `Thread.Sleep`: продолжает ставить задачи в очередь, отсюда рост `inflight`. Heartbeat-поток (0x12) жив, поэтому лог пишется.

## Что предлагаю
- Исправление в коде (за владельцами сервиса, я код не менял): сделать `GetPrice` асинхронным и использовать `await prices.GetPriceAsync(...)` вместо `.Result` (Program.cs:117 и делегат в Program.cs:46-52). Блокирующих ожиданий на потоках пула быть не должно.
- Временная мера: перезапустить сервис. Увеличение `ORDERS_MAX_WORKERS` только отодвигает проблему: при том же потоке заказов пул снова заполнится.
- Мониторинг: алерт на рост `inflight` при неизменном `processed` и на `threadpool-queue-length` (dotnet-counters).
- Дамп /tmp/w.dmp в контейнере можно удалить после разбора.
