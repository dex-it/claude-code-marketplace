---
name: docker
description: Docker — ловушки, безопасность, оптимизация образов. Активируется при docker, dockerfile, container, multi-stage, docker-compose
allowed-tools: Read, Grep, Glob
---

# Docker

## Правила

- Multi-stage builds: SDK для сборки, runtime для запуска
- Порядок слоёв: от редко меняемого к часто меняемому (cache)
- Non-root user в runtime образе
- Specific tags (`8.0.0`), не `:latest`
- `.dockerignore` обязателен
- Secrets через runtime env/mount, не через ENV в Dockerfile
- HEALTHCHECK в каждом образе

## Анти-паттерны

```dockerfile
# Плохо — всё в одном слое, SDK в runtime (700MB вместо 200MB)
FROM mcr.microsoft.com/dotnet/sdk:8.0
COPY . .
RUN dotnet publish -c Release -o /app
ENTRYPOINT ["dotnet", "/app/MyApp.dll"]

# Плохо — порядок слоёв убивает кэш
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
COPY . .                    # любой файл изменился → restore заново
RUN dotnet restore
RUN dotnet build

# Хорошо — restore кэшируется пока csproj не меняется
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
COPY ["MyApp/MyApp.csproj", "MyApp/"]
RUN dotnet restore "MyApp/MyApp.csproj"
COPY . .
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
RUN adduser --disabled-password --gecos "" --uid 1000 appuser
USER appuser
COPY --from=build /app/publish .
HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:8080/health || exit 1
ENTRYPOINT ["dotnet", "MyApp.dll"]

# Плохо — секреты в образе
ENV API_KEY=secret123
ENV ConnectionStrings__Default="Host=prod-db;Password=s3cr3t"

# Плохо — несколько RUN создают лишние слои
RUN apt-get update
RUN apt-get install -y curl
RUN apt-get clean

# Хорошо — один слой
RUN apt-get update && \
    apt-get install -y curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
```

## Размеры образов

| Image | Size | Когда |
|-------|------|-------|
| sdk:8.0 | ~700 MB | Build stage |
| aspnet:8.0 | ~200 MB | Web apps |
| runtime:8.0 | ~180 MB | Console apps |
| aspnet:8.0-alpine | ~100 MB | Size-critical (тестируй!) |
| runtime-deps:8.0-alpine + self-contained | ~50 MB | Минимум |

## Self-contained + trimmed

```dockerfile
# Минимальный образ — без .NET runtime
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
COPY . .
RUN dotnet publish -c Release -r linux-x64 \
    --self-contained true \
    /p:PublishTrimmed=true \
    /p:PublishSingleFile=true \
    -o /app/publish

FROM mcr.microsoft.com/dotnet/runtime-deps:8.0-alpine
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["./MyApp"]
```

## Security checklist

- [ ] Non-root user (`USER appuser`)
- [ ] Specific image tags, не `:latest`
- [ ] No secrets в ENV/COPY — только runtime injection
- [ ] `.dockerignore` включает `.env`, `.git`, `bin/`, `obj/`
- [ ] `--read-only` filesystem где возможно
- [ ] `docker scan` / `trivy` в CI
- [ ] Build-time secrets через `--mount=type=secret`

## .dockerignore — не забывай

```
**/.git
**/.vs
**/.vscode
**/bin
**/obj
**/.env
**/appsettings.Development.json
**/node_modules
```
