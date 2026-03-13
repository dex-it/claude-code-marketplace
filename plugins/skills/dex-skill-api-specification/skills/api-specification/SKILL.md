---
name: api-specification
description: API design — ошибки контрактов, версионирования, naming. Активируется при api design, openapi, REST API contract, api versioning, endpoint design
---

# API Specification — ловушки дизайна

## Правила

- Nouns для ресурсов, не verbs (GET /users, не GET /getUsers)
- Plural nouns (/users, не /user)
- Max 2-3 уровня вложенности в URL
- Versioning с первого дня (URL: /api/v1/)
- ProblemDetails (RFC 7807) для ошибок
- Pagination обязательна для списков

## Частые ошибки дизайна

```yaml
# Плохо — verbs в URL
GET /getUsers
POST /createOrder
DELETE /removeProduct/123
# REST = ресурсы, а не действия

# Хорошо — nouns
GET /users
POST /orders
DELETE /products/123

# Плохо — глубокая вложенность
GET /users/{userId}/orders/{orderId}/items/{itemId}/reviews/{reviewId}
# Невозможно кэшировать, сложно поддерживать

# Хорошо — max 2-3 уровня
GET /users/{userId}/orders
GET /orders/{orderId}/items
GET /reviews/{reviewId}

# Плохо — inconsistent naming
GET /user-list        # kebab + list
POST /CreateNewUser   # PascalCase + verb
GET /product_items    # snake_case
# Клиент гадает как назван следующий endpoint

# Хорошо — consistent plural nouns, kebab-case
GET /users
POST /users
GET /order-items

# Плохо — POST возвращает 200 без Location
POST /orders → 200 OK { "id": 123 }
# Клиент не знает URL созданного ресурса

# Хорошо — 201 + Location header
POST /orders → 201 Created
Location: /api/v1/orders/123

# Плохо — разный формат ошибок
400 → { "error": "bad request" }
404 → { "message": "not found" }
500 → "Internal Server Error"
# Клиент не может парсить — 3 разных формата

# Хорошо — единый ProblemDetails
400 → { "type": "...", "title": "Validation Error", "status": 400,
         "errors": { "email": ["Invalid format"] } }

# Плохо — boolean params для фильтрации
GET /users?active=true&premium=true&verified=true
# Каждый новый фильтр = новый param, взрыв комбинаций

# Хорошо — structured filtering
GET /users?filter[status]=active&filter[tier]=premium
```

## Версионирование — когда ломающее изменение

| Ломающее (нужна новая версия) | НЕ ломающее |
|-------------------------------|-------------|
| Удаление поля из response | Добавление нового поля |
| Переименование поля | Добавление нового endpoint |
| Изменение типа поля (string→int) | Добавление optional param |
| Удаление endpoint | Deprecation header |
| Изменение status code семантики | Новый error code |

## Pagination — cursor vs offset

| Критерий | Offset (page/pageSize) | Cursor |
|----------|----------------------|--------|
| Простота | Проще для клиента | Сложнее |
| Consistency | Пропуск/дублирование при insert/delete | Стабильный |
| Deep pages | Медленно (OFFSET 10000) | Быстро |
| Когда | CRUD админки, <10K записей | Feeds, real-time, >10K |

## Чек-лист

- [ ] URL: nouns, plural, kebab-case, max 2-3 уровня
- [ ] POST → 201 + Location header
- [ ] Единый формат ошибок (ProblemDetails)
- [ ] Pagination для всех list endpoints
- [ ] Versioning в URL (/api/v1/)
- [ ] Breaking changes → новая версия API
- [ ] Examples в OpenAPI spec для request/response
- [ ] idempotency: PUT и DELETE идемпотентны
