## Симптом
Процесс orders-worker (dotnet, PID 11) жив, CPU 0%, но `processed` в /work/logs/worker.log застыл на 40, а `inflight` растёт (102 → 150 → … → 438, шаг ~48 за 2 с); rss медленно растёт.

## Причина
Голодание (starvation) пула потоков: пул ограничен ключом конфигурации `ORDERS_MAX_WORKERS=8` (/work/orders-worker.env) → `ThreadPool.SetMaxThreads(8, 8)` (Program.cs:39), а обработчик в `Task.Run` (Program.cs:46-52) синхронно блокирует рабочий поток через `PriceClient.GetPrice => GetPriceAsync(sku).Result` (Program.cs:117). Все 8 рабочих потоков заняты вызовами `.Result`, а продолжение `await Task.Delay(30)` в `GetPriceAsync` (Program.cs:113) должно выполниться на том же пуле, свободных потоков нет — взаимная блокировка, `processed` не растёт.

## Улики
1. Лог:
```
docker exec diag46-d1-c1 tail -n 15 /work/logs/worker.log
12s processed=40 inflight=342 rss=31MB
14s processed=40 inflight=390 rss=31MB
16s processed=40 inflight=438 rss=31MB
```
2. Конфигурация: `docker exec diag46-d1-c1 cat /work/orders-worker.env` → `ORDERS_MAX_WORKERS=8`.
3. Потоки: `ls /proc/11/task` — 19 потоков, все в `futex_wait`/`ppoll`, нет running (CPU 0%).
4. Дамп (`dotnet-dump collect -p 11`, затем `dotnet-dump analyze d.dmp -c threadpool`):
```
Workers Total:    8
Workers Running:  8
Workers Idle:     0
Worker Min Limit: 4
Worker Max Limit: 8
```
5. `clrstack -all`: все 8 потоков пула стоят в одном и том же стеке:
```
System.Threading.Monitor.ObjWait
System.Threading.Tasks.Task.SpinThenBlockingWait
System.Threading.Tasks.Task.InternalWaitCore
Modes+<>c__DisplayClass3_1.<Hang>b__0()
System.Threading.Tasks.Task`1[[System.Decimal]].InnerInvoke()
System.Threading.ThreadPoolWorkQueue.Dispatch()
```
6. `dumpheap -stat -type Task`: 48 `AsyncStateMachineBox<PriceClient+<GetPriceAsync>d__0>` + 48 `DelayPromise` (ждут продолжения) и 597 `Task<Decimal>` (очередь заказов).

## Что предлагаю
- Исправление в коде: убрать синхронное ожидание — сделать `GetPrice` асинхронным (`await GetPriceAsync(...)`), обработчик — `async`, `Task.Run(async () => ...)`. Блокирующие `.Result`/`.Wait()` в пуле не использовать.
- Временная мера: перезапустить сервис (потоки не освободятся сами) и поднять `ORDERS_MAX_WORKERS` — это лишь отсрочка, при росте нагрузки голодание вернётся.
- Добавить в мониторинг рост `inflight` при неизменном `processed` как алерт.
- Код и конфигурация в рамках диагностики не менялись; дамп лежит в контейнере в /tmp/d.dmp.
