# REPORT: падение orders-worker

## Симптом
Процесс orders-worker упал ночью, лог потерян. Остался дамп /work/dumps/orders-worker.dmp, созданный средой выполнения при падении. В дампе 3 управляемых потока. У потока финализатора (DBG 5, OSID 0x10) есть необработанное `System.InvalidOperationException`: "slab 28 already released".

## Причина
`NativeSlab` не вызывает `GC.SuppressFinalize` в `Dispose()` (/work/src/Program.cs:154). Каждый объект, освобождённый через `using` (Program.cs:79), всё равно попадает в очередь финализации. Его финализатор `~NativeSlab()` (Program.cs:155) снова вызывает `Release()`. `Release()` на уже освобождённом объекте бросает исключение (Program.cs:151, `_released == true`). Необработанное исключение в потоке финализатора завершает процесс. Сработало в режиме `fincrash`: `GC.Collect()` и `GC.WaitForPendingFinalizers()` на Program.cs:82-83.

## Улики
Команда: `docker exec diag46-d3-d2 sh -c 'cd /tmp; dotnet-dump analyze /work/dumps/orders-worker.dmp -c "clrthreads" -c "setthread 5" -c "pe -lines" -c "clrstack"'`

Фрагмент `clrthreads`:
```
   5    2       10 0000AAAAD25002C0    21220 Preemptive ... (Finalizer) System.InvalidOperationException 0000fffc860015a8
```
Фрагмент `pe -lines`:
```
Exception type:   System.InvalidOperationException
Message:          slab 28 already released
OrdersWorker.dll!NativeSlab.Release()+0x124 [Program.cs @ 151]
OrdersWorker.dll!NativeSlab.Finalize()+0x28 [Program.cs @ 155]
```
Фрагмент `clrstack`:
```
NativeSlab.Release() [Program.cs @ 151]
NativeSlab.Finalize() [Program.cs @ 155]
```
Стек состоит только из кадров финализатора. Пользовательского кода в стеке нет, значит, объект был освобождён раньше через `Dispose`.

## Что предлагаю
- Добавить `GC.SuppressFinalize(this)` в `Dispose()` (Program.cs:154).
- Сделать `Release()` идемпотентным: при `_released == true` просто возвращаться, не бросать исключение. Из финализатора исключения вообще не должны выходить.
- Лучше перейти на `SafeHandle` или стандартный шаблон `Dispose(bool)`.
- Код в рамках этой диагностики не менялся.
