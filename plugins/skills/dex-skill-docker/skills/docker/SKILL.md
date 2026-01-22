---
name: docker
description: Docker containerization best practices for .NET and other applications - multi-stage builds, security, optimization, docker-compose. Activate for docker, container, dockerfile, image, multi-stage, docker-compose, containerization.
allowed-tools: Read, Grep, Glob
---

# Docker Best Practices

Comprehensive Docker containerization knowledge for .NET and other applications.

## Core Principles

1. **Multi-stage builds** - Separate build and runtime
2. **Layer optimization** - Order layers by change frequency
3. **Security** - Run as non-root, scan for vulnerabilities
4. **Size optimization** - Minimal base images, clean up artifacts
5. **Caching** - Maximize build cache efficiency

## Multi-Stage Build Pattern

### Standard .NET Pattern

```dockerfile
# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy csproj and restore (cached layer)
COPY ["MyApp/MyApp.csproj", "MyApp/"]
RUN dotnet restore "MyApp/MyApp.csproj"

# Copy source and build
COPY . .
WORKDIR "/src/MyApp"
RUN dotnet build "MyApp.csproj" -c Release -o /app/build

# Stage 2: Publish
FROM build AS publish
RUN dotnet publish "MyApp.csproj" -c Release -o /app/publish /p:UseAppHost=false

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

### With Tests

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

### Why Multi-Stage?

- **Smaller images**: Runtime doesn't include SDK (~200MB vs ~700MB)
- **Security**: Fewer tools = smaller attack surface
- **Speed**: Faster pulls and startup
- **Separation**: Build and runtime dependencies isolated

## Layer Optimization

### Order of Operations

Order layers from least to most frequently changing:

```dockerfile
# 1. Base image (changes rarely)
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build

# 2. Working directory (never changes)
WORKDIR /src

# 3. Project files (changes when dependencies change)
COPY ["MyApp.csproj", "./"]

# 4. Restore dependencies (cached until csproj changes)
RUN dotnet restore

# 5. Source code (changes frequently)
COPY . .

# 6. Build (only runs when source changes)
RUN dotnet build -c Release
```

### Poor vs Good Ordering

**Poor (everything rebuilds on source change):**
```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0
COPY . .
RUN dotnet restore
RUN dotnet build
```

**Good (restore cached when only source changes):**
```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0
COPY ["*.csproj", "./"]
RUN dotnet restore
COPY . .
RUN dotnet build
```

## .dockerignore

Always include:

```
**/.dockerignore
**/.env
**/.git
**/.gitignore
**/.vs
**/.vscode
**/.idea
**/*.*proj.user
**/*.dbmdl
**/bin
**/obj
**/node_modules
**/TestResults
**/secrets.dev.yaml
LICENSE
README.md
**/appsettings.Development.json
```

**Benefits:** Smaller build context, faster builds, fewer secrets leaked.

## Base Image Selection

### Official Microsoft Images

```dockerfile
# ASP.NET Core runtime (for web apps)
FROM mcr.microsoft.com/dotnet/aspnet:8.0

# .NET runtime (for console apps)
FROM mcr.microsoft.com/dotnet/runtime:8.0

# .NET SDK (for building)
FROM mcr.microsoft.com/dotnet/sdk:8.0
```

### Size Comparison

| Image | Size |
|-------|------|
| sdk:8.0 | ~700 MB |
| aspnet:8.0 | ~200 MB |
| runtime:8.0 | ~180 MB |
| aspnet:8.0-alpine | ~100 MB |

### Choosing Base Image

- **Build stage**: Always use `sdk`
- **ASP.NET Core apps**: Use `aspnet`
- **Console apps**: Use `runtime`
- **Size-critical**: Consider Alpine (test thoroughly!)

## Security Best Practices

### 1. Run as Non-Root User

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app

# Create non-root user
RUN adduser --disabled-password --gecos "" --uid 1000 appuser
USER appuser

COPY --chown=appuser:appuser --from=publish /app/publish .
ENTRYPOINT ["dotnet", "MyApp.dll"]
```

### 2. Read-Only Root Filesystem

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app

RUN mkdir -p /tmp/aspnet && \
    adduser --disabled-password --gecos "" --uid 1000 appuser && \
    chown appuser:appuser /tmp/aspnet /app

USER appuser
ENV ASPNETCORE_TEMP=/tmp/aspnet

COPY --chown=appuser:appuser --from=publish /app/publish .
ENTRYPOINT ["dotnet", "MyApp.dll"]
```

Deploy with: `docker run --read-only --tmpfs /tmp/aspnet myapp`

### 3. Drop Capabilities (Kubernetes)

```yaml
securityContext:
  capabilities:
    drop:
      - ALL
  runAsNonRoot: true
  runAsUser: 1000
  readOnlyRootFilesystem: true
```

### 4. Scan for Vulnerabilities

```bash
docker scan myapp:latest      # Docker scan
trivy image myapp:latest      # Trivy
snyk container test myapp     # Snyk
```

### 5. No Secrets in Images

**Bad:**
```dockerfile
ENV API_KEY=secret123  # BAD!
```

**Good:**
```dockerfile
# Pass at runtime
# docker run -e API_KEY=secret123 myapp
```

### 6. Specific Tags

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0.0  # Good
FROM mcr.microsoft.com/dotnet/aspnet:latest  # Bad
```

## Image Size Optimization

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

### Clean Up in Same Layer

```dockerfile
# Bad (creates larger layer)
RUN apt-get update
RUN apt-get install -y curl
RUN apt-get clean

# Good (smaller layer)
RUN apt-get update && \
    apt-get install -y curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
```

## Health Checks

### Dockerfile

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1
```

### ASP.NET Core

```csharp
// Program.cs
app.MapHealthChecks("/health");

// Liveness - is the app running?
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = _ => false
});

// Readiness - is the app ready to serve traffic?
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
});
```

## Environment Configuration

```dockerfile
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
ENV DOTNET_RUNNING_IN_CONTAINER=true

# Performance tuning
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=true  # If no i18n needed
ENV DOTNET_GCHeapHardLimit=0x10000000  # 256MB heap limit

EXPOSE 8080
```

## Docker Compose for Development

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
    healthcheck:
      test: rabbitmq-diagnostics -q ping
      interval: 30s
      timeout: 10s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

## Build-time Secrets

```dockerfile
# syntax=docker/dockerfile:1.4

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Use secret during build
RUN --mount=type=secret,id=nuget_config,dst=/root/.nuget/NuGet/NuGet.Config \
    dotnet restore
```

```bash
docker build --secret id=nuget_config,src=./NuGet.Config .
```

## Quick Reference

### Build Commands

```bash
# Basic build
docker build -t myapp:latest .

# With cache from registry
docker build --cache-from myapp:latest -t myapp:latest .

# No cache
docker build --no-cache -t myapp:latest .

# Build specific stage
docker build --target test -t myapp:test .

# Enable BuildKit
DOCKER_BUILDKIT=1 docker build -t myapp .
```

### Run Commands

```bash
# Basic run
docker run -d -p 8080:8080 myapp:latest

# With environment variables
docker run -d -e ASPNETCORE_ENVIRONMENT=Production myapp

# With volume mount
docker run -d -v $(pwd)/config:/app/config:ro myapp

# With resource limits
docker run -d -m 512m --cpus 0.5 myapp

# Read-only filesystem
docker run --read-only --tmpfs /tmp myapp
```

### Debug Commands

```bash
docker logs myapp                  # View logs
docker logs -f myapp               # Follow logs
docker exec -it myapp /bin/bash    # Shell access
docker inspect myapp               # Inspect container
docker stats myapp                 # Resource usage
docker inspect --format='{{.State.Health.Status}}' myapp
```

## Common Pitfalls

| Pitfall | Problem | Solution |
|---------|---------|----------|
| No .dockerignore | Slow builds, secrets leaked | Always use .dockerignore |
| Running as root | Security vulnerability | Create non-root user |
| Using :latest | Non-reproducible builds | Use specific version tags |
| Large context | Slow builds | Use .dockerignore |
| Poor layer order | Low cache hits | Order stable to volatile |
| Secrets in image | Security breach | Use env vars or secrets |
