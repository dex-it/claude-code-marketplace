# Bundle: dex-bundle-dotnet-fullstack

Meta-plugin that combines multiple specialists into one role-based package.

## Automatic Installation

```bash
# Linux / macOS / WSL
./install-bundle/install-bundle.sh dotnet-fullstack

# Windows (PowerShell)
.\install-bundle\install-bundle.ps1 dotnet-fullstack

# Preview what will be installed
./install-bundle/install-bundle.sh dotnet-fullstack --dry-run
```

## Included Plugins

- `dex-dotnet-coder`
- `dex-dotnet-debugger`
- `dex-dotnet-reviewer`
- `dex-dotnet-tester`
- `dex-ef-specialist`
- `dex-dotnet-performance`
- `dex-postgresql-specialist`
- `dex-mongodb-specialist`
- `dex-rabbitmq-specialist`
- `dex-kafka-specialist`
- `dex-elasticsearch-specialist`
- `dex-redis-specialist`
- `dex-docker-specialist`
- `dex-kubernetes-specialist`
- `dex-cicd-gitlab`
- `dex-logging-seq`
- `dex-monitoring-grafana`
- `dex-skill-dotnet-patterns`
- `dex-skill-ef-core`
- `dex-skill-async-patterns`
- `dex-skill-rabbitmq`
- `dex-skill-kafka`
- `dex-skill-elasticsearch`
- `dex-skill-redis`
- `dex-skill-mongodb`
- `dex-skill-docker`
- `dex-skill-kubernetes`
- `dex-skill-logging`
- `dex-skill-observability`

## Installation

Since Claude Code doesn't have native bundle dependency management, install each component separately:

```bash
# Install all components
claude plugins install dex-dotnet-coder
claude plugins install dex-dotnet-debugger
claude plugins install dex-dotnet-reviewer
claude plugins install dex-dotnet-tester
claude plugins install dex-ef-specialist
claude plugins install dex-dotnet-performance
claude plugins install dex-postgresql-specialist
claude plugins install dex-mongodb-specialist
claude plugins install dex-rabbitmq-specialist
claude plugins install dex-kafka-specialist
claude plugins install dex-elasticsearch-specialist
claude plugins install dex-redis-specialist
claude plugins install dex-docker-specialist
claude plugins install dex-kubernetes-specialist
claude plugins install dex-cicd-gitlab
claude plugins install dex-logging-seq
claude plugins install dex-monitoring-grafana
claude plugins install dex-skill-dotnet-patterns
claude plugins install dex-skill-ef-core
claude plugins install dex-skill-async-patterns
claude plugins install dex-skill-rabbitmq
claude plugins install dex-skill-kafka
claude plugins install dex-skill-elasticsearch
claude plugins install dex-skill-redis
claude plugins install dex-skill-mongodb
claude plugins install dex-skill-docker
claude plugins install dex-skill-kubernetes
claude plugins install dex-skill-logging
claude plugins install dex-skill-observability
```

## Note

This bundle is a convenience wrapper. Each component plugin works independently.
