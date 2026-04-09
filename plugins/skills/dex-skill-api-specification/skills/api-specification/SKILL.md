---
name: api-specification
description: API design — ловушки контрактов, naming, версионирования. Активируется при api design, openapi, REST API contract, api versioning, ProblemDetails, RFC 7807, pagination, cursor, kebab-case, breaking change, idempotency, Location header
---

# API Specification — ловушки дизайна

## URL Design

### Verbs в URL
Плохо: `GET /getUsers`, `POST /createOrder`, `DELETE /removeProduct/123`
Правильно: `GET /users`, `POST /orders`, `DELETE /products/123` — ресурсы, не действия
Почему: REST = resources. Verbs в URL дублируют HTTP method и ломают единообразие

### Singular вместо plural
Плохо: `GET /user/123`, `POST /order`
Правильно: `GET /users/123`, `POST /orders` — plural nouns для коллекций
Почему: inconsistent naming между коллекцией и элементом путает клиентов

### Глубокая вложенность URL
Плохо: `GET /users/{id}/orders/{id}/items/{id}/reviews/{id}` — 4 уровня
Правильно: max 2-3 уровня: `/users/{id}/orders` + `/reviews/{id}` отдельно
Почему: невозможно кэшировать, сложно поддерживать, URL становится хрупким

### Inconsistent naming style
Плохо: `/user-list` (kebab+list), `/CreateNewUser` (PascalCase), `/product_items` (snake)
Правильно: `kebab-case`, plural nouns: `/users`, `/order-items`
Почему: клиент гадает как назван следующий endpoint, нет предсказуемости

## Response Contract

### POST без Location header
Плохо: `POST /orders` -> `200 OK { "id": 123 }` — клиент не знает URL ресурса
Правильно: `201 Created` + `Location: /api/v1/orders/123`
Почему: без Location клиент вынужден конструировать URL вручную, что хрупко

### Разный формат ошибок
Плохо: 400 -> `{"error":"bad"}`, 404 -> `{"message":"not found"}`, 500 -> plain text
Правильно: единый ProblemDetails (RFC 7807) для всех ошибок
Почему: клиент не может парсить ответ, если каждый status code возвращает свой формат

### Boolean params для фильтрации
Плохо: `GET /users?active=true&premium=true&verified=true` — взрыв комбинаций
Правильно: `GET /users?filter[status]=active&filter[tier]=premium`
Почему: каждый новый фильтр = новый param, невозможно масштабировать

## Версионирование

### Breaking change без новой версии
Плохо: переименовать/удалить поле или изменить тип (`string` -> `int`) в текущей версии
Правильно: новая версия API (`/api/v2/`) при любом breaking change
Почему: существующие клиенты ломаются. Добавление полей/endpoints — не breaking, удаление/переименование — breaking

### Нет версии с первого дня
Плохо: `GET /api/users` — без версии в URL
Правильно: `GET /api/v1/users` — версия с первого релиза
Почему: добавить версию позже = breaking change для всех существующих клиентов

## Pagination

### Offset для больших данных
Плохо: `GET /orders?page=1000&pageSize=20` — OFFSET 20000 в SQL
Правильно: cursor-based pagination для feeds/real-time/10K+ записей
Почему: OFFSET N сканирует N строк и выбрасывает. На глубоких страницах — деградация O(N)

### Список без пагинации
Плохо: `GET /orders` без limit — возвращает все 100K записей
Правильно: пагинация обязательна для всех list endpoints, default pageSize=20
Почему: OOM на сервере, timeout на клиенте, DoS вектор

## Idempotency

### PUT/DELETE не идемпотентны
Плохо: `DELETE /orders/123` возвращает 204 первый раз, 500 второй
Правильно: повторный `DELETE` -> 404 или 204 (оба варианта допустимы, но стабильно)
Почему: сетевые retry при timeout вызывают повторный запрос, неидемпотентный DELETE = ошибка при retry

## Чек-лист

- URL: nouns, plural, kebab-case, max 2-3 уровня
- POST -> 201 + Location header
- Единый формат ошибок (ProblemDetails)
- Pagination для всех list endpoints
- Versioning в URL с первого дня (/api/v1/)
- Breaking changes -> новая версия API
- PUT и DELETE идемпотентны
