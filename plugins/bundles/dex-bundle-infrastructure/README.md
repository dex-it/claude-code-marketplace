# Bundle: dex-bundle-infrastructure

Complete infrastructure bundle: databases, messaging, containers, CI/CD, monitoring.

## Installation

```bash
# Linux / macOS / WSL
./install-bundle/install-bundle.sh infrastructure

# Windows (PowerShell)
.\install-bundle\install-bundle.ps1 infrastructure

# Preview what will be installed
./install-bundle/install-bundle.sh infrastructure --dry-run
```

## Uninstallation

```bash
# Linux / macOS / WSL
./install-bundle/uninstall-bundle.sh infrastructure

# Windows (PowerShell)
.\install-bundle\uninstall-bundle.ps1 infrastructure
```

## Included Components (23)

### Specialists (12)
- `dex-postgresql-specialist` - PostgreSQL databases
- `dex-mongodb-specialist` - MongoDB databases
- `dex-rabbitmq-specialist` - RabbitMQ messaging
- `dex-kafka-specialist` - Kafka streaming
- `dex-elasticsearch-specialist` - Elasticsearch search
- `dex-redis-specialist` - Redis caching
- `dex-docker-specialist` - Docker containers
- `dex-kubernetes-specialist` - Kubernetes orchestration
- `dex-cicd-gitlab` - GitLab CI/CD
- `dex-cicd-teamcity` - TeamCity CI/CD
- `dex-logging-seq` - Seq logging
- `dex-monitoring-grafana` - Grafana monitoring

### Skills (11)
- `dex-skill-rabbitmq` - RabbitMQ patterns
- `dex-skill-kafka` - Kafka patterns
- `dex-skill-elasticsearch` - Elasticsearch patterns
- `dex-skill-redis` - Redis patterns
- `dex-skill-mongodb` - MongoDB patterns
- `dex-skill-docker` - Docker best practices
- `dex-skill-kubernetes` - Kubernetes patterns
- `dex-skill-gitlab-ci` - GitLab CI/CD patterns
- `dex-skill-teamcity` - TeamCity patterns
- `dex-skill-logging` - Logging patterns
- `dex-skill-observability` - Observability patterns

## Note

This bundle is a convenience wrapper. Each component plugin works independently.
