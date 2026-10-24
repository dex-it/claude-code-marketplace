# REPORT: orders-worker

## Симптом
- Процесс dotnet (PID 11, `app/OrdersWorker.dll hang`) жив, CPU ~0%, `processed=40` не меняется, `inflight` растёт примерно на 50 за 2 с (105 → 597 за 22 с).
- Все потоки процесса в `futex_wait`, runnable-потоков нет.

## Причина
Исчерпание пула потоков (thread pool starvation) из-за sync-over-async. Лимит пула задан `ORDERS_MAX_WORKERS=8` (`/work/orders-worker.env`), код вызывает `ThreadPool.SetMaxThreads(8, 8)` (Program.cs:39). Все 8 рабочих потоков пула заняты задачами, которые блокирующе ждут другую задачу через `Task.Wait` (`Modes.Hang` → `<Hang>b__0`). Продолжениям, которые должны завершить эти задачи, свободных потоков нет, поэтому это взаимная блокировка (deadlock): потоки ждут работу, которую могли бы выполнить только они сами.

## Улики
1. `docker exec diag46-d1-h1 sh -c 'ps -eLo pid,tid,stat,wchan:20,comm'`
   Фрагмент: `11 19 Ssl futex_wait 0.0 .NET TP Worker` (то же у всех 8 потоков TP Worker, CPU 0).
2. `dotnet-dump collect -p 11` и `dotnet-dump analyze -c threadpool`
   Фрагмент: `Workers Total: 8 / Workers Running: 8 / Workers Idle: 0 / Worker Max Limit: 8`, `CPU utilization: 0%`.
3. `dotnet-dump analyze -c "clrstack -all"`: стек выглядит так у всех 8 потоков пула (`grep -c "Hang>b__0"` = 8):
   ```
   System.Threading.Monitor.ObjWait
   System.Threading.ManualResetEventSlim.Wait
   System.Threading.Tasks.Task.SpinThenBlockingWait
   System.Threading.Tasks.Task.InternalWaitCore
   Modes+<>c__DisplayClass3_1.<Hang>b__0()
   System.Threading.Tasks.Task`1[System.Decimal].InnerInvoke()
   System.Threading.ThreadPoolWorkQueue.Dispatch()
   ```
4. Главный поток: `Thread.Sleep` в `Modes.Hang() [Program.cs @ 53]`. Он только держит процесс живым и новые заказы не принимает.
5. `syncblk`: удерживаемых managed-мониторов нет, то есть это не lock, а блокирующее ожидание задач.
6. Лог `/work/logs/worker.log`: `22s processed=40 inflight=597 rss=31MB`. Очередь растёт, обработка стоит.

## Что предлагаю
- Срочно: перезапустить сервис. Это снимет зависание, но не причину.
- Исправление в коде (отдельной задачей, сервис я не менял): убрать блокирующее ожидание (`.Result` / `.Wait()`) внутри задач пула (например, `GetPrice` → `GetPriceAsync(sku).Result`, Program.cs:117) и перейти на `await` по всей цепочке.
- Конфигурация: `ORDERS_MAX_WORKERS=8` оставляет мало запаса. Увеличение лимита только отодвинет проблему, пока блокирующие ожидания остаются.
- Мониторинг: алерт на `threadpool-queue-length` растёт при неменяющемся `threadpool-completed-items-count` и на неменяющийся `processed`.
- Артефакт: `/work/hang.dmp` (полный дамп процесса в лаборатории) — удалить после разбора.
