# Bundle: dex-bundle-dotnet-fullstack

Complete bundle for .NET fullstack: development, databases, messaging, containers, CI/CD, monitoring.

## Installation

```bash
# Linux / macOS / WSL
./install-bundle/install-bundle.sh dotnet-fullstack

# Windows (PowerShell)
.\install-bundle\install-bundle.ps1 dotnet-fullstack

# Preview what will be installed
./install-bundle/install-bundle.sh dotnet-fullstack --dry-run
```

## Uninstallation

```bash
# Linux / macOS / WSL
./install-bundle/uninstall-bundle.sh dotnet-fullstack

# Windows (PowerShell)
.\install-bundle\uninstall-bundle.ps1 dotnet-fullstack
```

## Included Components

Полный состав - `bundle.json` (`includes[]`); ниже - ключевые компоненты роли, не весь перечень.

### Команды
- `/design` - дизайн-решение и ADR
- `/discover` - обзорное ревью существующего кода
- `/find-bugs` - активный поиск багов в фиче
- `/implement` - реализация фичи до локальных коммитов
- `/investigate` - расследование инцидента на стенде
- `/mr-review` - первичное ревью чужого MR/PR
- `/review-plan` - план правок по замечаниям ревью
- `/root-cause` - поиск первопричины бага по коду
- `/test` - тесты на изменённый код

### .NET Specialists + общие ревью/отладка
- `dex-dotnet-coder` - .NET coding assistant
- `dex-dotnet-tester` - Unit testing with xUnit/Moq
- `dex-ef-specialist` - Entity Framework Core specialist
- `dex-dotnet-performance` - Performance analysis
- `dex-debugger` - языко-агностичный root-cause (грузит .NET-skills по стеку)
- `dex-self-reviewer` - саморевью своей ветки перед push
- `dex-mr-reviewer` - ревью чужого MR

### Infrastructure Specialists
- `dex-postgresql-specialist` - PostgreSQL databases
- `dex-mongodb-specialist` - MongoDB databases
- `dex-rabbitmq-specialist` - RabbitMQ messaging
- `dex-kafka-specialist` - Kafka streaming
- `dex-elasticsearch-specialist` - Elasticsearch search
- `dex-redis-specialist` - Redis caching
- `dex-docker-specialist` - Docker containers
- `dex-kubernetes-specialist` - Kubernetes orchestration
- `dex-cicd-gitlab` - GitLab CI/CD
- `dex-logging-seq` - Seq logging
- `dex-monitoring-grafana` - Grafana monitoring

### Skills
- `dex-skill-dotnet-patterns` - SOLID, DI, async/await patterns
- `dex-skill-dotnet-ef-core` - EF Core best practices
- `dex-skill-dotnet-async-patterns` - Async/await patterns
- `dex-skill-rabbitmq` - RabbitMQ patterns
- `dex-skill-kafka` - Kafka patterns
- `dex-skill-elasticsearch` - Elasticsearch patterns
- `dex-skill-redis` - Redis patterns
- `dex-skill-mongodb` - MongoDB patterns
- `dex-skill-docker` - Docker best practices
- `dex-skill-kubernetes` - Kubernetes patterns
- `dex-skill-dotnet-logging` - Logging patterns
- `dex-skill-observability` - Observability patterns

## Note

This bundle is a convenience wrapper. Each component plugin works independently.
