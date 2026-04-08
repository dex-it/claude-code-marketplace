---
name: api-testing
description: API тестирование — ловушки сценариев, status codes, контрактов. Активируется при api testing, rest api test, integration test, contract testing, WebApplicationFactory, Testcontainers, status code, ProblemDetails, 401, 403, 409, Location header, happy path, concurrent access, flaky test, InMemoryDatabase
---

# API Testing — ловушки

## Database

### InMemoryDatabase вместо реальной БД
Плохо: `UseInMemoryDatabase("Test")` в тестах API
Правильно: `Testcontainers` с реальным PostgreSQL/SQL Server
Почему: InMemory не поддерживает транзакции, constraints, SQL-специфичные запросы. Тест зелёный, production красный

## Response Contract

### POST без проверки Location header
Плохо: `Assert.Equal(HttpStatusCode.Created, response.StatusCode)` — и всё
Правильно: проверять `response.Headers.Location` + GET по Location возвращает 200
Почему: без Location клиент не знает URL нового ресурса, контракт 201 неполный

### Не проверяют ProblemDetails формат
Плохо: `Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode)` — без проверки тела
Правильно: десериализовать `ValidationProblemDetails`, проверить конкретные поля в `Errors`
Почему: тело может быть строкой, HTML или другим JSON — клиент не сможет парсить

## Status Codes

### Только happy path (200 OK)
Плохо: тесты покрывают только успешные сценарии
Правильно: матрица status codes: GET -> 200/401/403/404, POST -> 201/400/401/409, DELETE -> 204/401/403/404
Почему: 80% багов в error handling, не в happy path. Пропущенный 401/403 = security hole

### Нет теста на 401 vs 403
Плохо: проверяют только "не авторизован" без разделения
Правильно: 401 (нет токена) и 403 (есть токен, нет прав) — разные тесты
Почему: перепутанные 401/403 ломают клиентскую логику redirect vs error message

## Isolation

### Shared state между тестами
Плохо: `static int _createdOrderId` — один тест создаёт, другой читает
Правильно: каждый тест создаёт свои данные и чистит за собой
Почему: порядок выполнения тестов не гарантирован, flaky при параллельном запуске

## Concurrency

### Нет теста на concurrent access
Плохо: тесты только с одним пользователем
Правильно: два "пользователя" читают одну версию, первый обновляет (200), второй получает 409
Почему: без optimistic concurrency теста — last write wins, данные первого пользователя потеряны

## Edge Cases

### Пагинация без граничных значений
Плохо: тест только с `page=1&pageSize=10`
Правильно: тестировать `page=0`, `page=-1`, `pageSize=0`, `pageSize=999999`
Почему: часто нет валидации граничных значений, 500 Internal Server Error в production

### Пустой список возвращает null
Плохо: не тестируют `GET /orders` когда 0 записей
Правильно: пустая коллекция должна возвращать `[]`, не `null`
Почему: `null` ломает клиентский `response.data.map()`, 0 записей — валидное состояние

### Idempotency не проверена
Плохо: `DELETE /orders/123` тестируют только один раз
Правильно: повторный DELETE/PUT должен возвращать тот же результат
Почему: сетевые retry вызывают повторный запрос, неидемпотентный endpoint = ошибка

### Content-Type отсутствует
Плохо: не тестируют запрос без `Content-Type` header
Правильно: запрос без Content-Type должен вернуть 415, не 500
Почему: клиент может забыть header, необработанный случай = Internal Server Error

## Чек-лист

- Testcontainers, не InMemoryDatabase
- POST: 201 + Location header + GET по Location
- Все error status codes протестированы (400, 401, 403, 404, 409)
- Ошибки возвращают ProblemDetails
- Тесты изолированы, нет shared state
- Concurrent access -> 409 Conflict
- Пагинация: невалидные page/pageSize
- Пустые коллекции: [] а не null
