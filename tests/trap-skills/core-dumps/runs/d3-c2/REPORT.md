# Отчёт: падение orders-worker

## Симптом
Процесс завершён средой выполнения по необработанному исключению; лог потерян, остался дамп `/work/dumps/orders-worker.dmp`. В дампе 3 потока, исключение `System.InvalidOperationException` у потока финализатора (thread 5).

## Причина
Двойное освобождение `NativeSlab`: `Dispose()` вызывает `Release()` (`/work/src/Program.cs:154`), а финализатор `~NativeSlab()` (`Program.cs:155`) вызывает `Release()` повторно. `Release()` на `Program.cs:151` бросает `InvalidOperationException("slab N already released")`, если `_released` уже true. Dispose не вызывает `GC.SuppressFinalize(this)`. Исключение в финализаторе необработано, и процесс падает. Сценарий — режим `fincrash` (`Program.cs:75-86`, `using var slab = new NativeSlab(i)`).

## Улики
Команда: `dotnet-dump analyze /work/dumps/orders-worker.dmp -c "clrthreads"`
```
5    2  10 ... 21220 Preemptive ... (Finalizer) System.InvalidOperationException 0000fffc9a0015a8
```
Команда: `dotnet-dump analyze ... -c "setthread 5" -c "pe -lines 0000fffc9a0015a8" -c "clrstack"`
```
Exception type:   System.InvalidOperationException
Message:          slab 28 already released
OrdersWorker.dll!NativeSlab.Release()+0x124 [Program.cs @ 151]
OrdersWorker.dll!NativeSlab.Finalize()+0x28 [Program.cs @ 155]
```
Стек состоит только из `Release` и `Finalize` на потоке финализатора, то есть повторное освобождение идёт из финализатора после `Dispose`.

## Что предлагаю
- В `Dispose()` вызывать `GC.SuppressFinalize(this)`.
- Сделать `Release()` идемпотентным: при `_released == true` просто возвращаться, не бросать исключение.
- Исключения из финализатора не выпускать наружу.
- Лучше заменить финализатор на `SafeHandle` или стандартный dispose-паттерн.
- Код сервиса я не менял.
