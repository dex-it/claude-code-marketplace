# Bundle: dex-bundle-devops

Bundle for DevOps engineers: Docker, Kubernetes, CI/CD, monitoring, logging.

## Installation

```bash
# Linux / macOS / WSL
./install-bundle/install-bundle.sh devops

# Windows (PowerShell)
.\install-bundle\install-bundle.ps1 devops

# Preview what will be installed
./install-bundle/install-bundle.sh devops --dry-run
```

## Uninstallation

```bash
# Linux / macOS / WSL
./install-bundle/uninstall-bundle.sh devops

# Windows (PowerShell)
.\install-bundle\uninstall-bundle.ps1 devops
```

## Included Components (11)

### Specialists (6)
- `dex-docker-specialist` - Docker containers
- `dex-kubernetes-specialist` - Kubernetes orchestration
- `dex-cicd-gitlab` - GitLab CI/CD
- `dex-cicd-teamcity` - TeamCity CI/CD
- `dex-logging-seq` - Seq logging
- `dex-monitoring-grafana` - Grafana monitoring

### Skills (5)
- `dex-skill-docker` - Docker best practices
- `dex-skill-kubernetes` - Kubernetes patterns
- `dex-skill-gitlab-ci` - GitLab CI/CD patterns
- `dex-skill-teamcity` - TeamCity patterns
- `dex-skill-observability` - Observability patterns

## Note

This bundle is a convenience wrapper. Each component plugin works independently.
