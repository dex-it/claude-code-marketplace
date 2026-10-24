# REPORT: падение orders-worker

## Симптом
Процесс orders-worker упал ночью, лог потерян. Дамп создан средой выполнения при необработанном исключении. В дампе 3 управляемых потока; исключение `System.InvalidOperationException` находится на потоке финализатора (thread 5, OSID 0x10).

## Причина
Двойное освобождение ресурса. `NativeSlab` реализует `IDisposable`, и `Dispose()` вызывает `Release()` (src/Program.cs:154). Деструктор `~NativeSlab()` тоже вызывает `Release()` (src/Program.cs:155). Флаг `_released` проверяется в `Release()` и приводит к `throw` (src/Program.cs:151), а `GC.SuppressFinalize(this)` в `Dispose()` не вызывается. После `using` (src/Program.cs:79) объект остаётся в очереди финализации. Финализатор вызывает `Release()` повторно и бросает исключение. Необработанное исключение в потоке финализатора завершает процесс.
Код вызова — режим `fincrash`, `Modes.FinCrash()`, src/Program.cs:75-86.

## Улики
Команда: `docker exec diag46-d3-d1 sh -c 'cd /work; dotnet-dump analyze dumps/orders-worker.dmp -c "setthread 5" -c "pe" -c "clrstack" -c "dumpheap -type NativeSlab -stat" -c "exit"'`

```
Exception type:   System.InvalidOperationException
Message:          slab 28 already released
    OrdersWorker.dll!NativeSlab.Release()+0x124
    OrdersWorker.dll!NativeSlab.Finalize()+0x28
NativeSlab.Release() [/tmp/src/orders-worker/Program.cs @ 151]
NativeSlab.Finalize() [/tmp/src/orders-worker/Program.cs @ 155]
ffff7bc2bc48    30       720 NativeSlab
```
Команда `clrthreads` в том же дампе показывает поток `5 ... (Finalizer) System.InvalidOperationException 0000fffc9e0015a8`.
В куче 30 объектов `NativeSlab`, что совпадает с циклом из 30 итераций в `FinCrash()`. Каждый из них уже был освобождён через `Dispose`.

## Что предлагаю
1. Сделать `Release()` идемпотентным: при `_released == true` просто вернуть управление, без `throw`.
2. Вызывать `GC.SuppressFinalize(this)` в `Dispose()`. Лучше перейти на стандартный dispose-pattern с `Dispose(bool disposing)`.
3. Финализатор не должен бросать исключения. Для обёртки над нативным ресурсом лучше `SafeHandle`.
4. Добавить тест на `using` с принудительным `GC.Collect()` и `GC.WaitForPendingFinalizers()`.
Код сервиса я не менял.
