# REPORT: падение orders-worker

## Симптом
Процесс завершился аварийно (дамп создан средой выполнения). В дампе:
- поток 1 (main) стоит в `GC.WaitForPendingFinalizers()` из `Modes.FinCrash()` (Program.cs:83);
- поток финализатора (DBG 5, OSID 0x10) несёт необработанное `System.InvalidOperationException: slab 28 already released`.

Необработанное исключение в финализаторе завершает процесс в .NET.

## Причина
`/work/src/Program.cs:143-156`, класс `NativeSlab`:
- `Dispose()` (стр. 154) вызывает `Release()` и не вызывает `GC.SuppressFinalize(this)`.
- Финализатор `~NativeSlab()` (стр. 155) вызывает тот же `Release()` ещё раз.
- `Release()` (стр. 151) при `_released == true` бросает `InvalidOperationException`.

Каждый слаб из `using var slab = new NativeSlab(i)` (стр. 79, режим `fincrash`) освобождается дважды: сначала через Dispose, потом из финализатора после `GC.Collect()` (стр. 82). Исключение в потоке финализатора убивает процесс.

## Улики
Все команды выполнялись как `docker exec diag46-d3-f2 sh -c 'cd /tmp; /root/.dotnet/tools/dotnet-dump analyze /work/dumps/orders-worker.dmp -c ...'`.

1. `-c "clrthreads"`:
```
ThreadCount:      3
   0    1        b ... Preemptive ... Ukn
   5    2       10 ... Preemptive ... Ukn (Finalizer) System.InvalidOperationException 0000fffc6a0015a8
```

2. `-c "clrstack"` (главный поток):
```
System.GC.WaitForPendingFinalizers()
Modes.FinCrash() [/tmp/src/orders-worker/Program.cs @ 83]
```

3. `-c "setthread 5" -c "pe -lines" -c "clrstack"`:
```
Exception type:   System.InvalidOperationException
Message:          slab 28 already released
    OrdersWorker.dll!NativeSlab.Release()+0x124 [Program.cs @ 151]
    OrdersWorker.dll!NativeSlab.Finalize()+0x28 [Program.cs @ 155]
```

4. `-c "dumpheap -type NativeSlab"`:
```
ffff4dc2bc48    30       720 NativeSlab
```
Все 30 созданных объектов ещё в куче и ждут финализации. Слаб 28 был одним из них, и его уже освободил `Dispose`.

## Что предлагаю
Код не менялся. Предложение для разработчиков:
1. В `NativeSlab.Dispose()` добавить `GC.SuppressFinalize(this)` после `Release()`.
2. Сделать `Release()` идемпотентным: при `_released == true` просто выходить, не бросая исключение. Из финализатора исключения бросать нельзя.
3. Нативный ресурс держать в `SafeHandle` или использовать стандартный шаблон `Dispose(bool disposing)`.
4. Для диагностики включить сохранение дампов и логирование в файл на персистентном томе, чтобы лог не терялся при падении.
