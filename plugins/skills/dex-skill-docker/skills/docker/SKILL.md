---
name: docker
description: Docker — ловушки, безопасность, оптимизация образов. Активируется при docker, dockerfile, container, multi-stage, docker-compose
---

# Docker — ловушки и anti-patterns

## Dockerfile

### SDK image в runtime stage
Плохо: `FROM mcr.microsoft.com/dotnet/sdk:8.0` + `ENTRYPOINT` — 700MB вместо 200MB
Правильно: multi-stage: sdk для build, aspnet/runtime для запуска
Почему: SDK содержит компиляторы, NuGet, MSBuild — не нужны в runtime. Больший образ = больше уязвимостей, медленнее pull

### Порядок слоёв убивает кэш
Плохо: `COPY . .` → `RUN dotnet restore` — любой файл изменился = restore заново
Правильно: `COPY *.csproj` → `RUN dotnet restore` → `COPY . .` → build
Почему: Docker кэширует по слоям. COPY . . инвалидирует кэш при ЛЮБОМ изменении файла. Restore = 30 сек на каждый build

### Секреты в ENV
Плохо: `ENV API_KEY=secret123` или `ENV ConnectionStrings__Default="Host=prod;Password=s3cr3t"`
Правильно: runtime env vars, Docker secrets, или `--mount=type=secret` для build-time
Почему: ENV запекается в image layer. `docker history` → видно всем кто имеет образ. Push в registry = секрет публичен

### Несколько RUN создают лишние слои
Плохо: 3 отдельных `RUN apt-get update`, `RUN apt-get install`, `RUN apt-get clean`
Правильно: один `RUN apt-get update && install && clean && rm -rf /var/lib/apt/lists/*`
Почему: каждый RUN = слой в image. apt cache остаётся в промежуточном слое даже после clean в следующем

### Нет non-root user
Плохо: контейнер запускается от root — `securityContext: {}` по умолчанию
Правильно: `RUN adduser --disabled-password appuser` + `USER appuser`
Почему: уязвимость в приложении + root = доступ к host filesystem через volume mounts. Container escape значительно проще от root

### :latest тег
Плохо: `FROM mcr.microsoft.com/dotnet/aspnet:latest`
Правильно: `FROM mcr.microsoft.com/dotnet/aspnet:8.0.1`
Почему: :latest изменится без предупреждения. Build на CI даёт разный результат через неделю. Невоспроизводимость

### HEALTHCHECK отсутствует
Плохо: контейнер запущен, но приложение крашнулось внутри — Docker считает его healthy
Правильно: `HEALTHCHECK --interval=30s CMD curl -f http://localhost:8080/health || exit 1`
Почему: без HEALTHCHECK orchestrator (compose/swarm) не перезапустит падший контейнер. В Kubernetes — через probes

## .dockerignore

### Забыт .dockerignore → секреты и мусор в контексте
Плохо: нет `.dockerignore` → `.env`, `.git`, `bin/`, `obj/` попадают в build context
Правильно: `.dockerignore` с `.git`, `.env`, `bin/`, `obj/`, `node_modules`, `appsettings.Development.json`
Почему: утечка секретов из `.env` в image. `.git` = гигабайты лишнего контекста → медленный build

## Image sizing trade-offs

| Image | Size | Когда |
|-------|------|-------|
| aspnet:8.0 | ~200 MB | Стандартный выбор для web apps |
| aspnet:8.0-alpine | ~100 MB | Size-critical (тестируй — musl libc отличия!) |
| runtime-deps:8.0-alpine + self-contained | ~50 MB | Минимум, но PublishTrimmed может сломать reflection |

### Self-contained + trimmed — скрытые проблемы
Плохо: `PublishTrimmed=true` → приложение падает в runtime с `MissingMethodException`
Правильно: тестируй trimmed build. Добавляй `TrimmerRootAssembly` для assemblies с reflection
Почему: trimmer удаляет "неиспользуемый" код, но не видит reflection, DI registration через `typeof`, JSON serialization
