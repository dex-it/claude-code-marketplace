---
name: dotnet-async-patterns
description: .NET async/await — блокировки, параллелизм, CancellationToken. Активируется при async, await, Task, CancellationToken, deadlock, .Result, .Wait(), SemaphoreSlim, fire-and-forget, thread pool starvation, async void, параллелизм, блокировка
---

# Async Patterns — ловушки и anti-patterns

## Главные анти-паттерны

### .Result / .Wait() — deadlock и starvation
Плохо: `var result = GetDataAsync().Result` или `.GetAwaiter().GetResult()`
Правильно: `var result = await GetDataAsync(ct)`
Почему: блокирует поток синхронно. В ASP.NET до .NET 6 — гарантированный deadlock (SynchronizationContext). В .NET 6+ — thread pool starvation под нагрузкой

### async void — исключения теряются
Плохо: `public async void ProcessAsync() { }` — нельзя await, исключения уходят в UnobservedTaskException
Правильно: `public async Task ProcessAsync(CancellationToken ct) { }`
Почему: исключение в async void crashит процесс (ASP.NET), или тихо теряется. Вызывающий код не знает об ошибке. Единственный допустимый случай — event handlers в WPF/WinForms

### Fire-and-forget без обработки ошибок
Плохо: `_ = SendEmailAsync();` — исключение никто не увидит
Правильно: `_ = Task.Run(async () => { try { await SendEmailAsync(); } catch (ex) { _logger.LogError(ex, "..."); } })`
Почему: unobserved exception → в .NET 4 crashит процесс, в .NET 6+ тихо логируется в EventLog. В обоих случаях — ошибка потеряна для приложения

### Task.Run для оборачивания sync в async
Плохо: `return Task.Run(() => _repo.GetOrder(id))` — fake async, пустая трата потока из пула
Правильно: используй реально асинхронный метод (`FirstOrDefaultAsync`, `ReadAsync`)
Почему: Task.Run берёт поток из ThreadPool для выполнения sync-кода. Под нагрузкой — thread pool exhaustion. Не масштабируется

### Ненужный async/await (overhead state machine)
Плохо: `async Task<Order> Get(int id, CancellationToken ct) { return await _repo.GetByIdAsync(id, ct); }`
Правильно: `Task<Order> Get(int id, CancellationToken ct) => _repo.GetByIdAsync(id, ct)` — прямой return Task
Почему: async/await создаёт state machine (~100 bytes alloc). Для простого проброса — overhead без выгоды. НО: оставь async/await если есть try/catch, using или несколько await

## CancellationToken

### Забытый CancellationToken
Плохо: `public async Task<Order> GetOrderAsync(int id)` — без CancellationToken
Правильно: пробрасывай `CancellationToken ct` до конца цепочки: Controller → Service → Repository → EF
Почему: клиент ушёл (закрыл вкладку), ASP.NET отменяет запрос, но без CancellationToken сервер продолжает тяжёлую работу вхолостую

### Нет ThrowIfCancellationRequested в долгих циклах
Плохо: `foreach (var item in 10000Items) await ProcessAsync(item)` — без проверки отмены
Правильно: `ct.ThrowIfCancellationRequested()` в начале каждой итерации
Почему: цикл на 10000 элементов продолжает работать даже после отмены запроса. CancellationToken проверяется только в async-вызовах внутри, но между ними — нет

### Linked token без timeout
Плохо: вызов внешнего API без timeout: `await _httpClient.GetAsync(url, ct)`
Правильно: `using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct); cts.CancelAfter(TimeSpan.FromSeconds(30));`
Почему: внешний API завис → ваш запрос висит бесконечно (или до клиентского timeout). Linked token = собственный timeout + наследование отмены от родителя

## Блокировки

### lock + await = deadlock
Плохо: `lock (_obj) { await DoSomethingAsync(); }` — компилятор даже не позволит, но есть обходы через Monitor
Правильно: `SemaphoreSlim(1, 1)` как async lock
Почему: lock захватывает поток. await отпускает поток. Когда continuation возвращается — lock занят другим потоком → deadlock

### SemaphoreSlim без try/finally
Плохо: `await _semaphore.WaitAsync(ct); await DoWork(); _semaphore.Release();`
Правильно: `await _semaphore.WaitAsync(ct); try { await DoWork(); } finally { _semaphore.Release(); }`
Почему: если DoWork бросит исключение — Release не вызовется, семафор навечно заблокирован, все последующие вызовы повиснут

### Unbounded parallelism
Плохо: `var tasks = urls.Select(url => httpClient.GetAsync(url)); await Task.WhenAll(tasks);`
Правильно: `SemaphoreSlim(maxConcurrency)` или `Parallel.ForEachAsync(MaxDegreeOfParallelism: 10)`
Почему: 10000 URLs = 10000 одновременных HTTP запросов → socket exhaustion, target server DDoS, timeout cascades

## Pipeline composition

### Побочный эффект синхронно блокирует критичный путь
Плохо: handler делает обязательный шаг (save в БД) + опциональный внешний вызов (analytics / notification) в одной цепочке `await`, всё — внутри транзакции пользовательского сценария
Правильно: обязательные шаги — синхронно до `SaveChangesAsync`, побочные эффекты — через domain event / message bus / outbox после коммита
Почему: побочный эффект (медленный внешний клиент, flaky API) блокирует критичный путь и может его завалить. Если внешний вызов упадёт — пользовательский сценарий должен был завершиться, а не откатиться. Публикация события даёт независимую retry-политику для побочного эффекта и сохраняет ответ пользователю

### Один handler делает >2 внешних вызовов последовательно
Плохо: handler ждёт VCS → ждёт analytics → ждёт notification service → возвращает ответ, latency = сумма всех
Правильно: декомпозиция через события / outbox (`EntityCreated` публикуется после save, каждый subscriber делает свой шаг независимо); параллельные независимые вызовы через `Task.WhenAll` (с ограничением concurrency)
Почему: последовательные внешние вызовы = накопленный timeout (3 сервиса × 10s = 30s). Падение одного ломает цепочку полностью. Декомпозиция изолирует failure domains + даёт независимый retry на каждый шаг

### Падение побочного эффекта роняет основной сценарий
Плохо: `try { await SaveAsync(); await NotifyAsync(); } catch { /* откат всего */ }` — notification падает, транзакция откачена
Правильно: save в одной транзакции → commit → публикация события → subscriber делает notification со своим retry
Почему: notification не должна откатывать данные. Разделение «persist» и «side-effect» по транзакционной границе (с outbox для гарантии at-least-once) — единственный способ сохранить корректность при падении побочных шагов

## Асинхронный контекст

### HttpContext в фоновом потоке
Плохо: `Task.Run(async () => { var user = _httpContextAccessor.HttpContext?.User; })` — HttpContext = null
Правильно: извлеки данные ДО перехода в фон: `var userId = HttpContext.User.FindFirst("sub")?.Value;`
Почему: HttpContext привязан к HTTP-запросу. В Task.Run — другой поток, запрос может уже завершиться → null или disposed

## Чек-лист

- Нет .Result / .Wait() / .GetAwaiter().GetResult()
- Нет async void (кроме event handlers)
- CancellationToken пробрасывается до конца цепочки
- Долгие циклы: ThrowIfCancellationRequested()
- lock → SemaphoreSlim в async коде, обязательно с try/finally
- Параллелизм ограничен (SemaphoreSlim / MaxDegreeOfParallelism)
- HttpContext: извлекай данные ДО фоновой задачи
- Побочные эффекты вынесены из критичного пути через события / outbox
- Handler не делает >2 последовательных внешних вызовов без декомпозиции
