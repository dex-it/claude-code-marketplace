## Симптом

orders-worker упал ночью, лог потерян. В дампе `/work/dumps/orders-worker.dmp` сервис работает в режиме `fincrash` (`Modes.FinCrash`). Главный поток стоит в `GC.WaitForPendingFinalizers()`. В потоке финализатора (thread 5) лежит необработанное `System.InvalidOperationException: slab 28 already released`. Необработанное исключение в финализаторе завершает процесс в .NET.

## Причина

`NativeSlab` освобождается дважды.

- `/work/src/Program.cs:154` — `Dispose()` вызывает `Release()` и не вызывает `GC.SuppressFinalize(this)`. Объект остаётся в очереди финализации.
- `/work/src/Program.cs:155` — финализатор `~NativeSlab()` снова вызывает `Release()`.
- `/work/src/Program.cs:151` — `Release()` при `_released == true` бросает `InvalidOperationException($"slab {_id} already released")`. Из финализатора это исключение уходит необработанным, и среда выполнения аварийно завершает процесс.
- `/work/src/Program.cs:79` — цикл в `FinCrash` создаёт 30 слэбов через `using`, то есть все они уже освобождены через `Dispose`. `GC.Collect()` (строка 82) запускает финализаторы, `GC.WaitForPendingFinalizers()` (строка 83) ждёт их.

Номера строк в дампе (`/tmp/src/orders-worker/Program.cs @ 151/155/83`) совпадают с `/work/src/Program.cs`.

## Улики

Команда: `docker exec diag46-d3-f1 sh -c 'cd /work/dumps; dotnet-dump analyze orders-worker.dmp -c "pe -lines" -c "clrthreads" -c "clrstack" -c "exit"'`

```
 DBG   ID     OSID ThreadOBJ           State ...
   0    1        b 0000AAAAD317B870  2020020 ...
   5    2       10 0000AAAAD31852C0    21220 ... (Finalizer) System.InvalidOperationException 0000fffc8a0015a8
...
0000FFFFFA5D87C0 0000FFFF6E5B017C System.GC.WaitForPendingFinalizers()
0000FFFFFA5D8880 0000FFFF6F391E38 Modes.FinCrash() [/tmp/src/orders-worker/Program.cs @ 83]
0000FFFFFA5D88C0 0000FFFF6F391CE4 Program.<Main>$(System.String[]) [/tmp/src/orders-worker/Program.cs @ 9]
```

Команда: `... -c "pe -lines 0000fffc8a0015a8" -c "setthread 5" -c "clrstack" -c "dumpheap -type NativeSlab"`

```
Exception type:   System.InvalidOperationException
Message:          slab 28 already released
    OrdersWorker.dll!NativeSlab.Release()+0x124 [/tmp/src/orders-worker/Program.cs @ 151]
    OrdersWorker.dll!NativeSlab.Finalize()+0x28 [/tmp/src/orders-worker/Program.cs @ 155]
...
ffff6f44bc48    30       720 NativeSlab
```

Все 30 экземпляров `NativeSlab` ещё в куче, то есть ждут финализации. `Dispose` для них уже отработал внутри `using`, поэтому `_released == true`, когда приходит финализатор.

## Что предлагаю

Код я не менял, это предложения для владельцев сервиса:

1. В `NativeSlab.Dispose()` добавить `GC.SuppressFinalize(this)` после `Release()`. Это основное исправление.
2. Сделать `Release()` идемпотентным: при `_released == true` просто выходить, не бросая исключение. Финализатор и `Dispose` часто вызывают её оба, и в финализаторе исключений быть не должно. Это шаблон Dispose (`Dispose(bool disposing)`).
3. Если слэб держит нативный ресурс, перейти на `SafeHandle`. Тогда финализатор не нужно писать вручную.
4. Добавить тест: создать и освободить `NativeSlab` в цикле, затем вызвать `GC.Collect(); GC.WaitForPendingFinalizers();`. Он должен завершаться без падения.
5. Чтобы следующий дамп тоже остался, включить сбор дампа при падении (`DOTNET_DbgEnableMiniDump=1`, `DOTNET_DbgMiniDumpName`) и писать stderr/stdout в постоянное хранилище.
