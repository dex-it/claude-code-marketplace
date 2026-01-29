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

## Included Components (29)

### .NET Specialists (6)
- `dex-dotnet-coder` - .NET coding assistant
- `dex-dotnet-debugger` - Bug hunting and debugging
- `dex-dotnet-reviewer` - Code review specialist
- `dex-dotnet-tester` - Unit testing with xUnit/Moq
- `dex-ef-specialist` - Entity Framework Core specialist
- `dex-dotnet-performance` - Performance analysis

### Infrastructure Specialists (11)
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

### Skills (12)
- `dex-skill-dotnet-patterns` - SOLID, DI, async/await patterns
- `dex-skill-ef-core` - EF Core best practices
- `dex-skill-async-patterns` - Async/await patterns
- `dex-skill-rabbitmq` - RabbitMQ patterns
- `dex-skill-kafka` - Kafka patterns
- `dex-skill-elasticsearch` - Elasticsearch patterns
- `dex-skill-redis` - Redis patterns
- `dex-skill-mongodb` - MongoDB patterns
- `dex-skill-docker` - Docker best practices
- `dex-skill-kubernetes` - Kubernetes patterns
- `dex-skill-logging` - Logging patterns
- `dex-skill-observability` - Observability patterns

## Note

This bundle is a convenience wrapper. Each component plugin works independently.
