---
name: nodejs-api
description: Node.js API ловушки — Express/Fastify/Hono, middleware, error handling, validation. Активируется при express, fastify, hono, middleware, node api, rest api, zod, validation, node.js
---

# Node.js API — ловушки и anti-patterns

## Error Handling

### Необработанная ошибка в async handler
Плохо: `app.get('/users', async (req, res) => { const users = await db.getUsers(); res.json(users) })` — ошибка = UnhandledPromiseRejection, сервер не отвечает
Правильно: error-handling middleware или wrapper: `app.get('/users', asyncHandler(async (req, res) => { ... }))`
Почему: Express не ловит rejected promises в route handlers. Запрос висит до timeout. В Fastify/Hono — ловится автоматически

### throw в middleware без next(err)
Плохо: `app.use((req, res, next) => { throw new Error('...') })` — Express crash
Правильно: `next(new AppError(400, 'message'))` + error middleware `(err, req, res, next) => { ... }`
Почему: throw в sync middleware крашит процесс. next(err) передаёт в error handler. В async — нужен try/catch + next(err)

### Error handler без 4 параметров
Плохо: `app.use((err, req, res) => { res.status(500).json(...) })` — 3 параметра, Express не распознаёт как error handler
Правильно: `app.use((err, req, res, next) => { ... })` — все 4 параметра обязательны
Почему: Express различает error middleware по количеству аргументов. 3 = обычный middleware, 4 = error handler

### Стектрейс клиенту
Плохо: `res.status(500).json({ error: err.message, stack: err.stack })` — production
Правильно: operational errors → клиенту, programming errors → логируй, клиенту generic message
Почему: stack trace раскрывает пути файлов, зависимости, внутреннюю структуру. Информация для атакующего

## Validation

### Доверие req.body без валидации
Плохо: `const { email, age } = req.body; await createUser(email, age)` — age может быть "hacked"
Правильно: Zod/Yup/Joi: `const data = createUserSchema.parse(req.body)` — валидация + type inference
Почему: req.body — untrusted input. Без валидации: SQL injection, type confusion, business logic bypass

### Валидация только на клиенте
Плохо: form validation в React, сервер принимает всё
Правильно: валидация на сервере обязательна, на клиенте — UX bonus
Почему: клиентскую валидацию обходят за 5 секунд через curl/Postman. Сервер = единственный гарант

### Zod schema не переиспользуется для типа
Плохо: `const schema = z.object({...})` + `interface User { ... }` — дублирование
Правильно: `type User = z.infer<typeof userSchema>` — один источник правды
Почему: при изменении schema тип не обновляется (или наоборот). Рассинхрон = баг

## Middleware

### Порядок middleware критичен
Плохо: error handler перед routes → никогда не вызовется. CORS после routes → не работает
Правильно: CORS → auth → body parser → routes → error handler — строго в таком порядке
Почему: Express/Fastify выполняет middleware последовательно. Неправильный порядок = тихий отказ

### Body parser без лимита
Плохо: `app.use(express.json())` — без лимита, клиент отправляет 100MB JSON → OOM
Правильно: `express.json({ limit: '1mb' })` — или nginx proxy_max_body_size
Почему: DoS через большой payload. Один запрос 1GB = node process crash

### Auth middleware на каждом route вместо группы
Плохо: `app.get('/users', auth, handler); app.get('/orders', auth, handler)` — забудешь на одном
Правильно: `router.use(auth)` — все routes в группе защищены
Почему: один endpoint без auth = уязвимость. Группировка гарантирует покрытие

## Process

### Нет graceful shutdown
Плохо: `process.exit(0)` по SIGTERM — обрывает in-flight запросы
Правильно: `server.close()` → дождаться завершения запросов → закрыть DB connections → exit
Почему: при deploy (Docker, K8s) SIGTERM отправляется перед kill. Без graceful shutdown — потеря данных, broken responses

### Секреты через process.env без валидации
Плохо: `const dbUrl = process.env.DATABASE_URL` — undefined в runtime, crash при первом запросе к БД
Правильно: валидация env при старте: `z.object({ DATABASE_URL: z.string().url() }).parse(process.env)`
Почему: typo в .env или забыл переменную → app стартует, падает через 5 минут при первом использовании. Fail fast at startup

### Нет health endpoint
Плохо: orchestrator (Docker/K8s) не знает жив ли сервис
Правильно: `GET /health` → `{ status: 'ok' }` + readiness check с проверкой DB
Почему: без health check — container restart не происходит при deadlock, memory leak, DB disconnect

## Performance

### Sync операции в event loop
Плохо: `fs.readFileSync()`, `JSON.parse(hugeString)`, crypto sync — блокирует event loop
Правильно: async API: `fs.promises.readFile()`, stream parsing, worker threads для CPU-heavy
Почему: Node.js = single thread. 100ms sync операция = 100ms задержка для ВСЕХ запросов

### Нет connection pooling
Плохо: `new Pool()` на каждый запрос или global connection без pool
Правильно: один Pool на приложение с настроенными min/max connections
Почему: новое соединение = TCP handshake + auth (~50ms). Без pool: 1000 req/s = 1000 connections → DB отказывает

## Чек-лист

- Async error handling (wrapper или framework support)
- Zod/валидация на все inputs, `z.infer` для типов
- Body parser с лимитом размера
- Graceful shutdown (SIGTERM → close → exit)
- Env валидация при старте (fail fast)
- Health endpoint для orchestrator
- Нет sync операций в event loop
- Connection pooling для DB
