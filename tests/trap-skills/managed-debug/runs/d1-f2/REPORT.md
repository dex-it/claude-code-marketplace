## Симптом
Процесс dotnet (PID 11, `dotnet app/OrdersWorker.dll hang`) жив, но `processed=40` не меняется, а `inflight` растёт линейно (102 -> 528 за 20 с, rss ~27-29MB, CPU 0%). Новые заказы принимаются, не обрабатываются.

## Причина
Исчерпание пула потоков (threadpool starvation, sync-over-async). Пул ограничен ключом конфигурации `ORDERS_MAX_WORKERS=8` (/work/orders-worker.env), код применяет его через `ThreadPool.SetMaxThreads(8, 8)` (/work/src/Program.cs:39). Все 8 рабочих потоков заблокированы в обработчике заказа на `PriceClient.GetPrice` -> `GetPriceAsync(sku).Result` (/work/src/Program.cs:117). Продолжение `await Task.Delay(30)` должно выполниться на том же пуле, свободных потоков нет, а новый поток пул создать не может (достигнут максимум). Получается взаимная блокировка: потоки ждут задачи, а задачам нужны эти потоки.

## Улики
1. Лог: `docker exec diag46-d1-f2 sh -c 'tail -n 15 /work/logs/worker.log'`
   ```
   2s processed=40 inflight=102 rss=27MB
   10s processed=40 inflight=293 rss=29MB
   20s processed=40 inflight=528 rss=29MB
   ```
2. Потоки ОС: `for t in /proc/11/task/*; do ... cat $t/wchan; done` - все ".NET TP Worker" (tid 19, 21, 23-28) в `futex_wait`, процесс в состоянии `S`, CPU 0%.
3. Дамп живого процесса: `dotnet-dump collect -p 11 -o /work/d.dmp`, затем `dotnet-dump analyze /work/d.dmp -c threadpool`
   ```
   Workers Total:    8
   Workers Running:  8
   Workers Idle:     0
   Worker Min Limit: 4
   Worker Max Limit: 8
   ```
4. `dotnet-dump analyze ... -c "clrstack -all"` - стек каждого рабочего потока пула (одинаковый):
   ```
   System.Threading.Monitor.ObjWait(Int32, System.Object)
   System.Threading.Tasks.Task.SpinThenBlockingWait(Int32, System.Threading.CancellationToken)
   System.Threading.Tasks.Task.InternalWaitCore(Int32, System.Threading.CancellationToken)
   Modes+<>c__DisplayClass3_1.<Hang>b__0()
   System.Threading.Tasks.Task`1[[System.Decimal, System.Private.CoreLib]].InnerInvoke()
   System.Threading.ThreadPoolWorkQueue.Dispatch()
   ```
   Основной поток спит в `Modes.Hang() [Program.cs @ 53]`, heartbeat-поток жив (`Program.cs @ 26`) - поэтому процесс выглядит здоровым. `syncblk` пуст: классических монитор-локов нет, ожидание идёт на Task.

## Что предлагаю
1. Срочно: перезапустить orders-worker, чтобы сбросить зависшие заказы (inflight накапливается в памяти, их нужно повторно принять). Это временная мера, проблема вернётся под нагрузкой.
2. Исправление в коде (отдельная задача разработчикам, код я не менял): убрать блокирующий `.Result` в `PriceClient.GetPrice` (Program.cs:117) и сделать цепочку обработки асинхронной (`await GetPriceAsync(...)`).
3. Конфигурация: не держать `ORDERS_MAX_WORKERS` на 8 при блокирующих вызовах. Поднятие лимита только отодвигает порог, не устраняет причину.
4. Мониторинг: алерт на `threadpool-queue-length` (рост) вместе с неизменным `processed` в логе, а не только на живость процесса.
