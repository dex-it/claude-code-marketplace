---
name: docker-best-practices
description: Docker and containerization best practices for .NET applications - multi-stage builds, security, optimization
allowed-tools: Read, Grep, Glob
---

# Docker Best Practices Skill

This skill provides expert knowledge of Docker containerization best practices for .NET applications.

## When to Activate

Activate this skill when:
- User needs help creating or optimizing Dockerfiles
- User asks about container security
- User wants to reduce image size
- User needs multi-stage build help
- User asks about Docker performance
- User needs help with Docker Compose

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
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "MyApp.dll"]
```

### Why Multi-Stage?

- **Smaller images**: Runtime image doesn't include SDK (~200MB vs ~700MB)
- **Security**: Fewer tools = smaller attack surface
- **Speed**: Faster image pulls and container startup
- **Separation**: Build-time and runtime dependencies separated

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

### Why Order Matters

Docker caches each layer. When a layer changes, all subsequent layers must rebuild. By ordering from stable to volatile, we maximize cache hits.

### Example: Poor vs Good Ordering

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

Always include a `.dockerignore` file:

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
**/secrets.dev.yaml
LICENSE
README.md
**/appsettings.Development.json
```

### Benefits

- Smaller build context
- Faster builds
- Fewer secrets accidentally copied
- Cleaner images

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

### Alpine Variants (Smaller Size)

```dockerfile
# ~100MB smaller
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine

# Note: Some native dependencies might not work
```

### Size Comparison

- `sdk:8.0` - ~700 MB
- `aspnet:8.0` - ~200 MB
- `runtime:8.0` - ~180 MB
- `aspnet:8.0-alpine` - ~100 MB

### Choosing the Right Base Image

- **Build stage**: Always use `sdk`
- **ASP.NET Core apps**: Use `aspnet`
- **Console apps**: Use `runtime`
- **Size-critical**: Consider Alpine (test thoroughly!)
- **Windows containers**: Use Windows base images

## Security Best Practices

### 1. Run as Non-Root User

**Why**: Limit damage if container is compromised

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app

# Create non-root user
RUN adduser --disabled-password --gecos "" --uid 1000 appuser
USER appuser

COPY --chown=appuser:appuser --from=publish /app/publish .
ENTRYPOINT ["dotnet", "MyApp.dll"]
```

### 2. Use Read-Only Root Filesystem

**Why**: Prevent runtime modifications

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app

# Create writable temp directory
RUN mkdir -p /tmp/aspnet && \
    adduser --disabled-password --gecos "" --uid 1000 appuser && \
    chown appuser:appuser /tmp/aspnet /app

USER appuser

ENV ASPNETCORE_TEMP=/tmp/aspnet

COPY --chown=appuser:appuser --from=publish /app/publish .
ENTRYPOINT ["dotnet", "MyApp.dll"]
```

Deploy with:
```bash
docker run --read-only --tmpfs /tmp/aspnet myapp
```

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
# Using Docker scan
docker scan myapp:latest

# Using Trivy
trivy image myapp:latest

# Using Snyk
snyk container test myapp:latest
```

### 5. Keep Images Updated

Regularly rebuild to get security patches:
```yaml
# In .gitlab-ci.yml
security-update:
  stage: build
  script:
    - docker build --no-cache --pull -t myapp:latest .
  schedule:
    - cron: "0 0 * * 0"  # Weekly
```

### 6. No Secrets in Images

**Bad:**
```dockerfile
ENV API_KEY=secret123  # BAD!
```

**Good:**
```dockerfile
# Pass at runtime
# docker run -e API_KEY=secret123 myapp
```

### 7. Minimal Attack Surface

- Use minimal base images (Alpine, distroless)
- Don't install unnecessary packages
- Remove build tools from final image
- Use specific image tags, not `:latest`

## Image Size Optimization

### 1. Multi-Stage Builds

Already covered - reduces image size by 3-4x.

### 2. Trimming (Self-Contained Apps)

```dockerfile
RUN dotnet publish -c Release -r linux-x64 \
    --self-contained true \
    /p:PublishTrimmed=true \
    /p:TrimMode=link
```

Can reduce size by ~50%, but test thoroughly!

### 3. Single-File Apps

```dockerfile
RUN dotnet publish -c Release -r linux-x64 \
    /p:PublishSingleFile=true \
    /p:PublishTrimmed=true
```

### 4. Alpine Base Images

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine
```

### 5. Clean Up in Same Layer

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

## Build Performance

### 1. Layer Caching Strategy

Order COPY commands to maximize cache hits:
```dockerfile
# These rarely change - cached
COPY ["*.csproj", "./"]
RUN dotnet restore

# These change often - not cached
COPY . .
RUN dotnet build
```

### 2. BuildKit

Enable BuildKit for faster builds:
```bash
export DOCKER_BUILDKIT=1
docker build -t myapp .
```

Benefits:
- Parallel build stages
- Efficient layer caching
- Better build output
- Secrets support

### 3. Parallel Project Builds

```dockerfile
# Restore all projects first
COPY ["ProjectA/ProjectA.csproj", "ProjectA/"]
COPY ["ProjectB/ProjectB.csproj", "ProjectB/"]
RUN dotnet restore "ProjectA/ProjectA.csproj"

# Copy all source
COPY . .

# Build in parallel (if projects are independent)
RUN dotnet build ProjectA -c Release & \
    dotnet build ProjectB -c Release & \
    wait
```

### 4. Use Bind Mounts for Local Development

```bash
# Fast feedback during development
docker run -v $(pwd):/app myapp
```

## Health Checks

### ASP.NET Core Health Checks

In `Program.cs`:
```csharp
app.MapHealthChecks("/health");
```

In Dockerfile:
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1
```

### Advanced Health Checks

```csharp
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

```dockerfile
# Kubernetes uses different endpoints
HEALTHCHECK CMD curl -f http://localhost:8080/health/live || exit 1
```

## Environment Configuration

### ASP.NET Core Settings

```dockerfile
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
ENV DOTNET_RUNNING_IN_CONTAINER=true

# Performance tuning
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=true  # If you don't need i18n
ENV DOTNET_GCHeapHardLimit=0x10000000  # 256MB heap limit

EXPOSE 8080
```

### Build Arguments

```dockerfile
ARG BUILD_CONFIGURATION=Release
RUN dotnet build -c ${BUILD_CONFIGURATION}

ARG DOTNET_VERSION=8.0
FROM mcr.microsoft.com/dotnet/sdk:${DOTNET_VERSION} AS build
```

Build with:
```bash
docker build --build-arg BUILD_CONFIGURATION=Debug -t myapp:debug .
```

## Docker Compose for Development

### Basic Setup

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
      - ConnectionStrings__Default=Host=db;Database=myapp;Username=postgres;Password=postgres
    depends_on:
      db:
        condition: service_healthy
    volumes:
      # Hot reload for development
      - ./appsettings.Development.json:/app/appsettings.Development.json:ro

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

### Override for Development

`docker-compose.override.yml`:
```yaml
version: '3.8'

services:
  api:
    build:
      target: build  # Stop at build stage for debugging
    environment:
      - ASPNETCORE_ENVIRONMENT=Development
    volumes:
      - ./src:/src:cached  # Source code hot reload
```

## Advanced Patterns

### 1. Frontend + Backend

```dockerfile
# Frontend build
FROM node:18 AS frontend-build
WORKDIR /app
COPY ["ClientApp/package*.json", "./"]
RUN npm ci
COPY ClientApp/ .
RUN npm run build

# Backend build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS backend-build
WORKDIR /src
COPY ["*.csproj", "./"]
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app/publish

# Final stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=backend-build /app/publish .
COPY --from=frontend-build /app/dist ./wwwroot
ENTRYPOINT ["dotnet", "MyApp.dll"]
```

### 2. Testing in Docker

```dockerfile
FROM build AS test
WORKDIR /src/tests
RUN dotnet test --logger "trx;LogFileName=test-results.trx"

# Continue with publish stage
FROM build AS publish
...
```

Run tests:
```bash
docker build --target test -t myapp:test .
```

### 3. Multi-Project Solution

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy all project files
COPY ["MyApp.sln", "./"]
COPY ["MyApp.Api/MyApp.Api.csproj", "MyApp.Api/"]
COPY ["MyApp.Core/MyApp.Core.csproj", "MyApp.Core/"]
COPY ["MyApp.Infrastructure/MyApp.Infrastructure.csproj", "MyApp.Infrastructure/"]

# Restore solution
RUN dotnet restore "MyApp.sln"

# Copy all source
COPY . .

# Build solution
RUN dotnet build "MyApp.sln" -c Release -o /app/build

# Publish main project
FROM build AS publish
RUN dotnet publish "MyApp.Api/MyApp.Api.csproj" -c Release -o /app/publish
```

## Common Pitfalls

### 1. Not Using .dockerignore

**Problem**: Slow builds, large images, secrets leaked

**Solution**: Always use .dockerignore

### 2. Running as Root

**Problem**: Security vulnerability

**Solution**: Create and use non-root user

### 3. Latest Tags

**Problem**: Non-reproducible builds, security issues

**Solution**: Use specific version tags
```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0.0  # Good
FROM mcr.microsoft.com/dotnet/aspnet:latest  # Bad
```

### 4. Large Build Context

**Problem**: Slow builds

**Solution**: Use .dockerignore, don't COPY unnecessarily

### 5. Poor Layer Ordering

**Problem**: Slow builds, low cache hit rate

**Solution**: Order from stable to volatile

### 6. Installing Unnecessary Packages

**Problem**: Large images, security vulnerabilities

**Solution**: Install only what's needed, clean up after

### 7. Secrets in Images

**Problem**: Security breach

**Solution**: Use environment variables, build secrets, or secret mounts

## Monitoring and Logging

### Structured Logging

```csharp
// In Program.cs
builder.Logging.AddJsonConsole();
```

Docker automatically captures stdout/stderr:
```bash
docker logs myapp
docker logs -f myapp  # Follow
docker logs --since 10m myapp  # Last 10 minutes
```

### Resource Limits

```bash
docker run -m 512m --cpus 0.5 myapp
```

Kubernetes:
```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "100m"
  limits:
    memory: "512Mi"
    cpu: "500m"
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

# With build args
docker build --build-arg DOTNET_VERSION=7.0 -t myapp:latest .
```

### Run Commands

```bash
# Basic run
docker run -d -p 8080:8080 myapp:latest

# With environment variables
docker run -d -p 8080:8080 -e ASPNETCORE_ENVIRONMENT=Production myapp:latest

# With volume mount
docker run -d -p 8080:8080 -v $(pwd)/config:/app/config:ro myapp:latest

# With resource limits
docker run -d -p 8080:8080 -m 512m --cpus 0.5 myapp:latest

# With health check
docker run -d -p 8080:8080 --health-cmd "curl -f http://localhost:8080/health" myapp:latest
```

### Debug Commands

```bash
# View logs
docker logs myapp

# Execute shell
docker exec -it myapp /bin/bash

# Inspect container
docker inspect myapp

# View resource usage
docker stats myapp

# Check health
docker inspect --format='{{.State.Health.Status}}' myapp
```

Remember: Security, performance, and maintainability are equally important!
