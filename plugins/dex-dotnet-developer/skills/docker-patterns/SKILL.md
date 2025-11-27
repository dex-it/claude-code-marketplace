---
name: docker-patterns
description: Docker для .NET приложений - Dockerfile, multi-stage builds, оптимизация, docker-compose. Активируется при docker, container, dockerfile, image, multi-stage, docker-compose, containerization
allowed-tools: Read, Grep, Glob
---

# Docker Patterns для .NET

## Multi-Stage Dockerfile

### Стандартный ASP.NET Core

```dockerfile
# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Restore (кэшируемый слой)
COPY ["MyApp/MyApp.csproj", "MyApp/"]
RUN dotnet restore "MyApp/MyApp.csproj"

# Build
COPY . .
WORKDIR "/src/MyApp"
RUN dotnet build -c Release -o /app/build

# Stage 2: Publish
FROM build AS publish
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

# Stage 3: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
EXPOSE 8080

# Non-root user
RUN adduser --disabled-password --gecos "" --uid 1000 appuser
USER appuser

COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "MyApp.dll"]
```

### С тестами

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY . .
RUN dotnet restore

# Run tests
FROM build AS test
RUN dotnet test --no-restore --verbosity normal

# Publish
FROM build AS publish
RUN dotnet publish -c Release -o /app/publish

# Runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "MyApp.dll"]
```

## Оптимизация размера

### Alpine образы

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS final
# aspnet:8.0 ~200MB, aspnet:8.0-alpine ~100MB
```

### Self-Contained + Trimmed

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY . .
RUN dotnet publish -c Release -r linux-x64 \
    --self-contained true \
    /p:PublishTrimmed=true \
    /p:PublishSingleFile=true \
    -o /app/publish

# Minimal runtime image
FROM mcr.microsoft.com/dotnet/runtime-deps:8.0-alpine
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["./MyApp"]
```

## .dockerignore

```
**/.dockerignore
**/.env
**/.git
**/.gitignore
**/.vs
**/.vscode
**/.idea
**/bin
**/obj
**/node_modules
**/TestResults
**/*.user
**/*.dbmdl
**/Dockerfile*
**/docker-compose*
LICENSE
README.md
```

## Docker Compose для разработки

```yaml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - ASPNETCORE_ENVIRONMENT=Development
      - ConnectionStrings__Default=Host=postgres;Database=myapp;Username=postgres;Password=postgres
      - Redis__Configuration=redis:6379
      - RabbitMQ__Host=rabbitmq
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
      rabbitmq:
        condition: service_healthy
    volumes:
      - ./appsettings.Development.json:/app/appsettings.Development.json:ro
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  rabbitmq:
    image: rabbitmq:3-management-alpine
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest
    healthcheck:
      test: rabbitmq-diagnostics -q ping
      interval: 30s
      timeout: 10s
      retries: 5

  elasticsearch:
    image: elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - ES_JAVA_OPTS=-Xms512m -Xmx512m
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data

  seq:
    image: datalust/seq:latest
    environment:
      ACCEPT_EULA: "Y"
    ports:
      - "5341:80"
    volumes:
      - seq_data:/data

volumes:
  postgres_data:
  redis_data:
  elasticsearch_data:
  seq_data:
```

## Секреты и переменные

### Build-time secrets

```dockerfile
# syntax=docker/dockerfile:1.4

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Использование секрета при build
RUN --mount=type=secret,id=nuget_config,dst=/root/.nuget/NuGet/NuGet.Config \
    dotnet restore
```

```bash
docker build --secret id=nuget_config,src=./NuGet.Config .
```

### Runtime конфигурация

```dockerfile
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

# НЕ хранить секреты в образе
# Передавать через: docker run -e API_KEY=xxx
```

## Health Checks

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1
```

```csharp
// Program.cs
app.MapHealthChecks("/health");
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
});
```

## Best Practices

1. **Multi-stage builds** - разделение build и runtime
2. **Non-root user** - безопасность
3. **Layer caching** - порядок COPY операций
4. **Specific tags** - не использовать :latest
5. **Health checks** - для оркестрации
6. **.dockerignore** - уменьшение контекста
7. **Secrets** - не хранить в образе
