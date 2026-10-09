---
name: dotnet-async-patterns
description: .NET async/await в изменении - фальшивый async через Task.Run над синхронным вызовом, у которого есть асинхронный API. Активируется при async, await, Task, Task.Run, фальшивый async, async над синхронным, ReadAllLines, ReadAllLinesAsync, thread pool, блокирующий I/O
---

# Async Patterns - чек-лист

Пункт называет ситуацию, которую изменение проверяет.

- `Task.Run` над синхронным вызовом, у которого есть асинхронный API
