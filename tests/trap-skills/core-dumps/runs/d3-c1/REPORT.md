# Отчёт: падение orders-worker

## Симптом
Процесс аварийно завершился; лог потерян, остался дамп /work/dumps/orders-worker.dmp. В дампе 3 потока (main, finalizer, heartbeat/служебный); у потока финализатора (DBG 5, OS tid 0x10) необработанное `System.InvalidOperationException`: "slab 28 already released".

## Причина
Двойное освобождение `NativeSlab`: `Dispose()` вызывает `Release()` и выставляет `_released = true`, но финализатор `~NativeSlab()` тоже вызывает `Release()`, а оно при `_released == true` бросает исключение. `GC.SuppressFinalize(this)` в `Dispose` нет. Исключение в потоке финализатора не перехватывается, и среда выполнения завершает процесс.
- src/Program.cs:151 — `throw new InvalidOperationException($"slab {_id} already released")`
- src/Program.cs:154 — `Dispose() => Release();` (нет `GC.SuppressFinalize`)
- src/Program.cs:155 — `~NativeSlab() => Release();`
- Источник объектов: src/Program.cs:77-81 (`FinCrash`, `using var slab = new NativeSlab(i)`, затем `GC.Collect()` / `WaitForPendingFinalizers()`).

## Улики
1. `dotnet-dump analyze orders-worker.dmp -c "clrthreads"`:
   `5  2  10 ... 21220 Preemptive ... (Finalizer) System.InvalidOperationException 0000fffc660015a8`
2. `dotnet-dump analyze orders-worker.dmp -c "setthread 5" -c "pe -lines 0000fffc660015a8" -c "clrstack"`:
   ```
   Exception type:   System.InvalidOperationException
   Message:          slab 28 already released
   OrdersWorker.dll!NativeSlab.Release()+0x124 [Program.cs @ 151]
   OrdersWorker.dll!NativeSlab.Finalize()+0x28 [Program.cs @ 155]
   ```
3. `dotnet-dump analyze orders-worker.dmp -c "dumpheap -type NativeSlab"`:
   `ffff4a02bc48  30  720 NativeSlab` — в куче все 30 созданных объектов, они ждут финализации. Дамп сделан во время финализации, и номер 28 в сообщении согласуется с тем, что до него Dispose уже отработал для всех 30.

## Что предлагаю
1. В `Dispose()` вызывать `GC.SuppressFinalize(this)` (классический dispose-паттерн: `Dispose(bool disposing)`).
2. Сделать `Release()` идемпотентным (при `_released` просто `return`) и не бросать исключения из финализатора.
3. Для нативных ресурсов использовать `SafeHandle`.
Код не менялся — это рекомендации.
