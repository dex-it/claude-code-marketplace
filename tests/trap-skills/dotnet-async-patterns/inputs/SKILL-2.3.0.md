---
name: dotnet-async-patterns
description: .NET async/await в изменении - фальшивый async над синхронным вызовом, отмена в долгом CPU-цикле. Активируется при async, await, Task, Task.Run, CancellationToken, отмена, долгий цикл, thread pool, ThrowIfCancellationRequested, фальшивый async
---

# Async Patterns - чек-лист

Пункт называет ситуацию, которую изменение проверяет.

- `Task.Run` над синхронным вызовом, у которого есть асинхронный API
- Долгий CPU-цикл под токеном отмены без проверки отмены
