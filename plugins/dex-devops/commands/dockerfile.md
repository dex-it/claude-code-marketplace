---
name: dockerfile
description: Create optimized Dockerfile for .NET application
---

# Dockerfile Command

Create an optimized, production-ready Dockerfile for a .NET application.

## Usage

```bash
/dockerfile [options]
```

## Options

- `--type` - Project type: api, console, blazor, worker (auto-detected if not specified)
- `--runtime` - Runtime image: aspnet, runtime, alpine (default: aspnet)
- `--sdk-version` - .NET SDK version (default: 8.0)
- `--multi-stage` - Use multi-stage build: true/false (default: true)
- `--non-root` - Run as non-root user: true/false (default: true)
- `--health-check` - Include health check: true/false (default: true for API)

## What This Command Does

1. **Project Analysis**
   - Detect .NET project type
   - Find solution and project files
   - Identify dependencies
   - Check for frontend assets (Blazor, React, etc.)

2. **Dockerfile Generation**
   - Create multi-stage Dockerfile
   - Optimize layer caching
   - Configure security settings
   - Add health checks (if applicable)

3. **Create .dockerignore**
   - Exclude build artifacts
   - Exclude development files
   - Optimize build context

4. **Validation**
   - Check Dockerfile syntax
   - Verify base images
   - Validate paths and commands

## Generated Dockerfile Structure

### ASP.NET Core API (Default)

```dockerfile
# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy csproj files and restore dependencies
COPY ["MyApp.Api/MyApp.Api.csproj", "MyApp.Api/"]
COPY ["MyApp.Core/MyApp.Core.csproj", "MyApp.Core/"]
COPY ["MyApp.Infrastructure/MyApp.Infrastructure.csproj", "MyApp.Infrastructure/"]
RUN dotnet restore "MyApp.Api/MyApp.Api.csproj"

# Copy source code and build
COPY . .
WORKDIR "/src/MyApp.Api"
RUN dotnet build "MyApp.Api.csproj" -c Release -o /app/build

# Stage 2: Publish
FROM build AS publish
RUN dotnet publish "MyApp.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 3: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

# Create non-root user
RUN adduser --disabled-password --gecos "" --uid 1000 appuser && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Copy published files
COPY --chown=appuser:appuser --from=publish /app/publish .

# Configure environment
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
ENV DOTNET_RUNNING_IN_CONTAINER=true

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Entry point
ENTRYPOINT ["dotnet", "MyApp.Api.dll"]
```

### Console Application

```dockerfile
# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy and restore
COPY ["MyApp/MyApp.csproj", "MyApp/"]
RUN dotnet restore "MyApp/MyApp.csproj"

# Build
COPY . .
WORKDIR "/src/MyApp"
RUN dotnet build "MyApp.csproj" -c Release -o /app/build

# Stage 2: Publish
FROM build AS publish
RUN dotnet publish "MyApp.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 3: Runtime
FROM mcr.microsoft.com/dotnet/runtime:8.0 AS final
WORKDIR /app

# Create non-root user
RUN adduser --disabled-password --gecos "" --uid 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

# Copy published files
COPY --chown=appuser:appuser --from=publish /app/publish .

# Entry point
ENTRYPOINT ["dotnet", "MyApp.dll"]
```

### Blazor Server

```dockerfile
# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy and restore
COPY ["MyBlazorApp/MyBlazorApp.csproj", "MyBlazorApp/"]
RUN dotnet restore "MyBlazorApp/MyBlazorApp.csproj"

# Build
COPY . .
WORKDIR "/src/MyBlazorApp"
RUN dotnet build "MyBlazorApp.csproj" -c Release -o /app/build

# Stage 2: Publish
FROM build AS publish
RUN dotnet publish "MyBlazorApp.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 3: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

# Create non-root user
RUN adduser --disabled-password --gecos "" --uid 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

# Copy published files
COPY --chown=appuser:appuser --from=publish /app/publish .

# Configure environment
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "MyBlazorApp.dll"]
```

### Worker Service

```dockerfile
# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy and restore
COPY ["MyWorker/MyWorker.csproj", "MyWorker/"]
RUN dotnet restore "MyWorker/MyWorker.csproj"

# Build
COPY . .
WORKDIR "/src/MyWorker"
RUN dotnet build "MyWorker.csproj" -c Release -o /app/build

# Stage 2: Publish
FROM build AS publish
RUN dotnet publish "MyWorker.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 3: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

# Create non-root user
RUN adduser --disabled-password --gecos "" --uid 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

# Copy published files
COPY --chown=appuser:appuser --from=publish /app/publish .

# Entry point
ENTRYPOINT ["dotnet", "MyWorker.dll"]
```

## Generated .dockerignore

```
**/.dockerignore
**/.env
**/.git
**/.gitignore
**/.project
**/.settings
**/.toolstarget
**/.vs
**/.vscode
**/.idea
**/*.*proj.user
**/*.dbmdl
**/*.jfm
**/azds.yaml
**/bin
**/charts
**/docker-compose*
**/Dockerfile*
**/node_modules
**/npm-debug.log
**/obj
**/secrets.dev.yaml
**/values.dev.yaml
LICENSE
README.md
**/appsettings.Development.json
```

## Optimization Techniques

### 1. Layer Caching

Order layers from least to most frequently changing:
- Base image
- csproj files (dependencies)
- Source code
- Build output

### 2. Multi-Project Solutions

For solutions with multiple projects:
```dockerfile
# Copy all project files first
COPY ["ProjectA/ProjectA.csproj", "ProjectA/"]
COPY ["ProjectB/ProjectB.csproj", "ProjectB/"]
COPY ["ProjectC/ProjectC.csproj", "ProjectC/"]

# Restore all at once
RUN dotnet restore "ProjectA/ProjectA.csproj"
```

### 3. Alpine Images (Smaller Size)

Use Alpine-based images for smaller size:
```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS final
```

Size comparison:
- `aspnet:8.0` - ~200 MB
- `aspnet:8.0-alpine` - ~100 MB

Note: Some native dependencies might not work on Alpine.

### 4. Static File Handling

For apps with frontend (React, Vue, etc.):
```dockerfile
# Frontend build stage
FROM node:18 AS frontend-build
WORKDIR /app
COPY ["ClientApp/package*.json", "./"]
RUN npm install
COPY ClientApp/ .
RUN npm run build

# .NET build stages...

# Final stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=publish /app/publish .
COPY --from=frontend-build /app/dist ./wwwroot
```

## Security Features

### 1. Non-Root User

Always run as non-root:
```dockerfile
RUN adduser --disabled-password --gecos "" --uid 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser
```

### 2. Read-Only Root Filesystem

For enhanced security:
```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

# Create temp directories
RUN mkdir -p /tmp/aspnet /tmp/dotnet && \
    adduser --disabled-password --gecos "" --uid 1000 appuser && \
    chown -R appuser:appuser /app /tmp/aspnet /tmp/dotnet

USER appuser

ENV ASPNETCORE_TEMP=/tmp/aspnet
ENV DOTNET_TEMP=/tmp/dotnet

COPY --chown=appuser:appuser --from=publish /app/publish .
ENTRYPOINT ["dotnet", "MyApp.dll"]
```

### 3. Minimal Base Images

Use minimal runtime images:
- `aspnet` for ASP.NET Core
- `runtime` for console apps
- Add `-alpine` suffix for smaller images

### 4. Security Scanning

Scan images after build:
```bash
docker scan myapp:latest
trivy image myapp:latest
```

## Build Arguments

Support build-time configuration:
```dockerfile
ARG BUILD_CONFIGURATION=Release
RUN dotnet build -c ${BUILD_CONFIGURATION}

ARG ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_ENVIRONMENT=${ASPNETCORE_ENVIRONMENT}
```

Build with arguments:
```bash
docker build --build-arg BUILD_CONFIGURATION=Debug -t myapp:debug .
```

## Health Check Configuration

### ASP.NET Core Health Checks

Add health check endpoint in `Program.cs`:
```csharp
app.MapHealthChecks("/health");
```

Dockerfile health check:
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1
```

### Advanced Health Checks

With readiness and liveness:
```csharp
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = _ => false
});

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
});
```

## Build and Run

### Build Image
```bash
docker build -t myapp:latest .
docker build -t myapp:1.0.0 .
```

### Run Container
```bash
# Basic run
docker run -d -p 8080:8080 myapp:latest

# With environment variables
docker run -d -p 8080:8080 \
  -e ASPNETCORE_ENVIRONMENT=Production \
  -e ConnectionStrings__Default="Host=db;Database=myapp" \
  myapp:latest

# With volume mount
docker run -d -p 8080:8080 \
  -v $(pwd)/appsettings.json:/app/appsettings.json:ro \
  myapp:latest
```

### Debug Container
```bash
# View logs
docker logs myapp

# Execute shell
docker exec -it myapp /bin/bash

# Inspect configuration
docker inspect myapp
```

## Docker Compose

Generate `docker-compose.yml` for local development:
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
      - db
    volumes:
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

volumes:
  postgres_data:
```

## Examples

```bash
# Generate Dockerfile for API project
/dockerfile --type api

# Generate Dockerfile with Alpine runtime
/dockerfile --runtime alpine

# Generate Dockerfile without health check
/dockerfile --health-check false

# Generate Dockerfile for console app
/dockerfile --type console

# Generate Dockerfile for .NET 7
/dockerfile --sdk-version 7.0
```

## Testing Generated Dockerfile

1. **Build Image**
   ```bash
   docker build -t test-app .
   ```

2. **Check Image Size**
   ```bash
   docker images test-app
   ```

3. **Run Container**
   ```bash
   docker run -d -p 8080:8080 --name test-container test-app
   ```

4. **Test Application**
   ```bash
   curl http://localhost:8080/health
   ```

5. **Check Logs**
   ```bash
   docker logs test-container
   ```

6. **Security Scan**
   ```bash
   docker scan test-app
   ```

## Troubleshooting

### Build Errors

- Check project paths in COPY commands
- Verify .csproj file names
- Check SDK version compatibility

### Runtime Errors

- Check ENTRYPOINT DLL name matches published output
- Verify port configuration
- Check environment variables

### Permission Issues

- Ensure proper ownership with --chown flag
- Verify user has access to required directories
- Check volume mount permissions

### Large Image Size

- Use multi-stage builds
- Use Alpine images
- Clean up build artifacts
- Optimize layer count

---

**Note**: Generated Dockerfile should be tested locally before use in production!
