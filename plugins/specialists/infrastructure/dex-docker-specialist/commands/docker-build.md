---
description: Сборка и анализ Docker образов - multi-stage, оптимизация, безопасность
allowed-tools: Bash, Read, Grep, Glob
argument-hint: [--analyze | --build | --scan]
---

# /docker-build

Сборка и анализ Docker образов.

## Использование

```
/docker-build --analyze              # Анализ Dockerfile
/docker-build --build                # Сборка образа
/docker-build --scan myapp:latest    # Сканирование уязвимостей
```

## Процесс

### 1. Поиск Dockerfile

```bash
find . -name "Dockerfile*" -type f 2>/dev/null
```

### 2. Анализ Dockerfile

Проверить:
- [ ] Multi-stage build
- [ ] Non-root user
- [ ] Layer ordering (COPY package*.json before COPY .)
- [ ] .dockerignore наличие
- [ ] Specific tags (не :latest)
- [ ] HEALTHCHECK

### 3. Сборка

```bash
DOCKER_BUILDKIT=1 docker build \
  --progress=plain \
  --build-arg BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ") \
  --build-arg VERSION=$(git describe --tags --always 2>/dev/null || echo "dev") \
  -t myapp:$(git rev-parse --short HEAD 2>/dev/null || echo "latest") \
  -f Dockerfile .
```

### 4. Анализ размера

```bash
# Размер образа
docker images myapp --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

# История слоёв
docker history myapp:latest --format "table {{.CreatedBy}}\t{{.Size}}"
```

### 5. Сканирование уязвимостей

```bash
# Docker Scout (если доступен)
docker scout cves myapp:latest

# Или Trivy
trivy image myapp:latest

# Или Grype
grype myapp:latest
```

## Вывод

```
Docker Build Analysis
=====================

Dockerfile: ./Dockerfile
Base Image: mcr.microsoft.com/dotnet/aspnet:8.0

Checklist:
[x] Multi-stage build (3 stages: build, publish, final)
[x] Non-root user (appuser:1000)
[x] .dockerignore present (15 rules)
[x] Layer ordering optimized
[x] Specific base image tags (8.0, not latest)
[ ] No HEALTHCHECK defined

Build Result:
- Image: myapp:abc1234
- Size: 210MB
- Layers: 12
- Build Time: 45s

Layer Breakdown:
+------------------------------------+--------+
| Layer                              | Size   |
+------------------------------------+--------+
| Base (aspnet:8.0)                  | 180MB  |
| App files                          | 25MB   |
| Configuration                      | 5MB    |
+------------------------------------+--------+

Security Scan:
+-----------+-------+
| Severity  | Count |
+-----------+-------+
| Critical  | 0     |
| High      | 2     |
| Medium    | 5     |
| Low       | 12    |
+-----------+-------+

High Vulnerabilities:
1. CVE-2024-xxxx in openssl (base image)
2. CVE-2024-yyyy in libcurl (base image)

Recommendations:
1. Add HEALTHCHECK instruction:
   HEALTHCHECK --interval=30s --timeout=3s \
     CMD curl -f http://localhost:8080/health || exit 1

2. Update base image to patch vulnerabilities:
   FROM mcr.microsoft.com/dotnet/aspnet:8.0.1

3. Consider alpine base for smaller size:
   FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine
   (reduces size from 210MB to ~110MB)
```

## Dockerfile Best Practices

### Рекомендуемая структура

```dockerfile
# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Restore first (cacheable layer)
COPY ["*.csproj", "./"]
RUN dotnet restore

# Build
COPY . .
RUN dotnet build -c Release -o /app/build

# Stage 2: Publish
FROM build AS publish
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

# Stage 3: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
EXPOSE 8080

# Security: non-root user
RUN adduser --disabled-password --gecos "" --uid 1000 appuser
USER appuser

COPY --from=publish /app/publish .

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "MyApp.dll"]
```

### .dockerignore

```
**/bin
**/obj
**/.git
**/.vs
**/.idea
**/node_modules
**/TestResults
Dockerfile*
docker-compose*
*.md
```
