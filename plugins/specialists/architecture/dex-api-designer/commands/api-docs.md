---
description: Генерация и валидация OpenAPI/Swagger документации
allowed-tools: Bash, Read, Write, Grep, Glob
---

# /api-docs

Генерация и валидация OpenAPI/Swagger документации для .NET API.

## Использование

```
/api-docs generate            # Сгенерировать OpenAPI spec
/api-docs validate            # Валидировать существующий spec
/api-docs diff                # Сравнить версии API
/api-docs export [format]     # Экспорт в JSON/YAML
```

## Процесс

### 1. Генерация OpenAPI из кода

**Через dotnet swagger CLI:**
```bash
# Установка (если нет)
dotnet tool install -g Swashbuckle.AspNetCore.Cli

# Генерация
dotnet swagger tofile --output openapi.json ./bin/Release/net8.0/MyApi.dll v1
```

**Через запущенное приложение:**
```bash
# Запустить приложение и получить spec
curl http://localhost:5000/swagger/v1/swagger.json -o openapi.json
```

### 2. Валидация спецификации

```bash
# Используя spectral (установка: npm install -g @stoplight/spectral-cli)
spectral lint openapi.json

# Или через OpenAPI MCP
# MCP автоматически валидирует при загрузке spec
```

**Типичные проблемы:**

| Код | Описание | Решение |
|-----|----------|---------|
| oas3-valid-schema-example | Неверный example | Исправить example в XML doc |
| operation-operationId | Нет operationId | Добавить [SwaggerOperation] |
| oas3-unused-component | Неиспользуемая схема | Удалить или использовать |

### 3. Сравнение версий API

```bash
# Используя oasdiff (https://github.com/Tufin/oasdiff)
oasdiff diff openapi-v1.json openapi-v2.json

# Breaking changes
oasdiff breaking openapi-v1.json openapi-v2.json
```

**Breaking changes to watch:**
- Удаление endpoint
- Изменение типа параметра
- Добавление required параметра
- Изменение response schema

### 4. Настройка Swashbuckle

**Program.cs:**
```csharp
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "My API",
        Version = "v1",
        Description = "API documentation",
        Contact = new OpenApiContact
        {
            Name = "API Support",
            Email = "api@example.com"
        }
    });

    // XML документация
    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    c.IncludeXmlComments(xmlPath);

    // JWT авторизация
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});
```

**Включить XML docs в .csproj:**
```xml
<PropertyGroup>
  <GenerateDocumentationFile>true</GenerateDocumentationFile>
  <NoWarn>$(NoWarn);1591</NoWarn>
</PropertyGroup>
```

## Выходной формат

```
OpenAPI Documentation Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Source: ./bin/Release/net8.0/MyApi.dll
Output: openapi.json
Version: 1.0.0

Endpoints discovered: 24
- GET    /api/v1/products (8)
- POST   /api/v1/products (3)
- PUT    /api/v1/products/{id} (3)
- DELETE /api/v1/products/{id} (2)
- ...

Schemas: 15
- ProductResponse
- CreateProductRequest
- ProductListResponse
- ErrorResponse
- ...

Validation: ✅ Passed (0 errors, 2 warnings)
⚠️ operation-description: GET /api/v1/products missing description
⚠️ oas3-valid-schema-example: ProductResponse.price example type mismatch

Files created:
- openapi.json (45 KB)
- openapi.yaml (38 KB)

Next steps:
1. Review generated documentation
2. Add missing descriptions
3. Fix validation warnings
4. Publish to API portal
```

## Интеграция

- **Notion:** Документировать API изменения
- **GitLab:** Добавить openapi.json в репозиторий
- **NSwag:** Сгенерировать клиентские SDK
