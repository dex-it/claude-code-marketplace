---
name: owasp-security
description: Безопасность веб-приложений, OWASP Top 10. Активируется при упоминании security, auth bypass, injection, XSS, IDOR, CSRF, уязвимость, безопасность, эскалация прав
allowed-tools: Read, Grep, Glob
---

# OWASP Security Patterns

## A01: Broken Access Control

### IDOR — доступ к чужим данным

```
// Плохо — пользователь может подменить id
GET /api/orders/123

public async Task<Order> GetOrder(int id)
{
    return await _repo.GetByIdAsync(id); // любой заказ
}

// Хорошо — фильтр по текущему пользователю
public async Task<Order?> GetOrder(int id, int currentUserId)
{
    var order = await _repo.GetByIdAsync(id);
    if (order?.UserId != currentUserId)
        return null; // или 403
    return order;
}
```

### Эскалация привилегий

```
// Плохо — роль приходит из запроса
public async Task UpdateUser(UpdateUserDto dto)
{
    user.Role = dto.Role; // клиент может передать Role = "Admin"
}

// Хорошо — роль из токена, смена роли только для админов
[Authorize(Roles = "Admin")]
public async Task SetUserRole(int userId, string role) { }
```

### Прямой доступ к чужим ресурсам

```
// Плохо — проверка только аутентификации
[Authorize]
public async Task DeleteDocument(int docId) { }

// Хорошо — проверка владельца
[Authorize]
public async Task DeleteDocument(int docId)
{
    var doc = await _repo.GetByIdAsync(docId);
    if (doc.OwnerId != currentUserId)
        throw new ForbiddenException();
}
```

## A02: Cryptographic Failures

### Хранение секретов

```
// Плохо
var connectionString = "Server=prod;Password=P@ssw0rd";
var apiKey = "sk-1234567890";

// Хорошо
var connectionString = configuration.GetConnectionString("Default");
var apiKey = configuration["ExternalApi:Key"]; // из Vault / env vars
```

### Хеширование паролей

```
// Плохо — MD5/SHA без соли
var hash = MD5.HashData(Encoding.UTF8.GetBytes(password));

// Хорошо — bcrypt/Argon2
var hash = BCrypt.Net.BCrypt.HashPassword(password, workFactor: 12);
var isValid = BCrypt.Net.BCrypt.Verify(password, hash);
```

## A03: Injection

### SQL Injection

```
// Плохо — конкатенация
var sql = $"SELECT * FROM Users WHERE Name = '{name}'";

// Хорошо — параметризованные запросы
var sql = "SELECT * FROM Users WHERE Name = @name";
await connection.QueryAsync(sql, new { name });

// EF Core — безопасно по умолчанию
await _context.Users.Where(u => u.Name == name).ToListAsync();

// EF Core — ОПАСНО с FromSqlRaw
await _context.Users.FromSqlRaw($"SELECT * FROM Users WHERE Name = '{name}'").ToListAsync();
// Хорошо:
await _context.Users.FromSqlInterpolated($"SELECT * FROM Users WHERE Name = {name}").ToListAsync();
```

### Command Injection

```
// Плохо
Process.Start("ping", userInput);

// Хорошо — валидация и whitelist
if (!IPAddress.TryParse(userInput, out var ip))
    throw new ValidationException("Invalid IP");
Process.Start("ping", ip.ToString());
```

### XSS

```
// Плохо — вывод без экранирования (НЕ ДЕЛАЙ ТАК)
@Html.Raw(userComment)

// Хорошо
@userComment                          // Razor экранирует по умолчанию
element.textContent = userData;       // JS: безопасно
```

## A04: Insecure Design

### Mass Assignment

```
// Плохо — биндинг всей модели
public async Task<IActionResult> Update([FromBody] User user) { }

// Хорошо — DTO с нужными полями
public record UpdateProfileDto(string Name, string Email);
public async Task<IActionResult> Update([FromBody] UpdateProfileDto dto) { }
```

### Rate Limiting

```
// Program.cs
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("api", opt =>
    {
        opt.Window = TimeSpan.FromMinutes(1);
        opt.PermitLimit = 100;
    });
});

[EnableRateLimiting("api")]
public class OrdersController : ControllerBase { }
```

## A07: Auth Failures

### JWT — типичные ошибки

```
// Плохо — не проверяет issuer/audience
var token = handler.ReadJwtToken(jwt); // без валидации подписи!

// Хорошо
var parameters = new TokenValidationParameters
{
    ValidateIssuer = true,
    ValidIssuer = "myapp",
    ValidateAudience = true,
    ValidAudience = "myapp-api",
    ValidateLifetime = true,
    ValidateIssuerSigningKey = true,
    IssuerSigningKey = key
};
handler.ValidateToken(jwt, parameters, out _);
```

### Brute Force защита

```
// Account lockout
services.Configure<IdentityOptions>(options =>
{
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
});
```

## A09: Logging Failures

### Что логировать

```
// Логируй: auth события, ошибки авторизации, input validation fails
logger.LogWarning("Login failed for {Email} from {IP}", email, ip);
logger.LogWarning("Access denied: user {UserId} tried to access order {OrderId}", userId, orderId);

// НЕ логируй: пароли, токены, персональные данные
// logger.LogInformation("Login: {Email}, password: {Password}"); // НИКОГДА
```

## Чек-лист ревью

При ревью публичных эндпоинтов проверяй:

- [ ] Есть `[Authorize]` или явная причина для анонимного доступа
- [ ] Проверка владельца ресурса (не только аутентификация)
- [ ] DTO вместо прямого биндинга моделей
- [ ] Параметризованные запросы (нет конкатенации SQL)
- [ ] Нет секретов в коде, конфигах, логах
- [ ] Rate limiting на auth/public эндпоинтах
- [ ] Input validation на границе системы
