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

## Included Components (37)

### Specialists (14)
- `dex-postgresql-specialist` - PostgreSQL databases
- `dex-mongodb-specialist` - MongoDB databases
- `dex-rabbitmq-specialist` - RabbitMQ messaging
- `dex-kafka-specialist` - Kafka streaming
- `dex-elasticsearch-specialist` - Elasticsearch search
- `dex-redis-specialist` - Redis caching
- `dex-docker-specialist` - Docker containers
- `dex-kubernetes-specialist` - Kubernetes orchestration
- `dex-cicd-gitlab` - GitLab CI/CD
- `dex-cicd-github` - GitHub Actions CI/CD
- `dex-cicd-teamcity` - TeamCity CI/CD
- `dex-cicd-jenkins` - Jenkins CI/CD
- `dex-logging-seq` - Seq logging
- `dex-monitoring-grafana` - Grafana monitoring

### Skills (13)
- `dex-skill-rabbitmq` - RabbitMQ patterns
- `dex-skill-kafka` - Kafka patterns
- `dex-skill-elasticsearch` - Elasticsearch patterns
- `dex-skill-redis` - Redis patterns
- `dex-skill-mongodb` - MongoDB patterns
- `dex-skill-docker` - Docker best practices
- `dex-skill-kubernetes` - Kubernetes patterns
- `dex-skill-gitlab-ci` - GitLab CI/CD patterns
- `dex-skill-github-actions` - GitHub Actions patterns
- `dex-skill-teamcity` - TeamCity patterns
- `dex-skill-jenkins` - Jenkins patterns
- `dex-skill-dotnet-logging` - Logging patterns
- `dex-skill-observability` - Observability patterns

### CLI Utilities (10)
- `dex-gitlab-cli` - GitLab CLI: pipelines, MRs, logs (`glab`)
- `dex-github-cli` - GitHub CLI: workflow runs, PRs, logs (`gh`)
- `dex-kubectl-cli` - Kubernetes CLI: pods, logs, deployments, contexts (`kubectl`)
- `dex-teamcity-cli` - TeamCity CLI: builds, agents, logs (REST)
- `dex-jenkins-cli` - Jenkins CLI: jobs, builds, console (REST)
- `dex-psql-cli` - PostgreSQL CLI: queries, schema, explain, locks (`psql`)
- `dex-redis-cli` - Redis CLI: info, keys, memory, monitor (`redis-cli`)
- `dex-kaf-cli` - Kafka CLI: topics, groups, consume, produce (`kaf`)
- `dex-rabbitmqadmin-cli` - RabbitMQ CLI: overview, queues, bindings, publish (`rabbitmqadmin-ng`)
- `dex-aws-s3-cli` - AWS S3 CLI: ls, bucket info, head-object, presigned URLs (`aws s3` / `s3api`)

## Note

This bundle is a convenience wrapper. Each component plugin works independently.

To install only the CLI plugins (without specialists/skills), use [`dex-bundle-cli-tools`](../dex-bundle-cli-tools/README.md). For the underlying CLI binaries (psql, redis-cli, kaf, ...) see [`docs/CLI_UTILITIES.md`](../../../docs/CLI_UTILITIES.md) and `install-bundle/install-cli-tools.sh`.
