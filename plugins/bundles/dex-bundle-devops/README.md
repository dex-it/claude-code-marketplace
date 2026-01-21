# Bundle: dex-bundle-devops

Meta-plugin that combines multiple specialists into one role-based package.

## Included Plugins

- `dex-docker-specialist`
- `dex-kubernetes-specialist`
- `dex-cicd-gitlab`
- `dex-cicd-teamcity`
- `dex-logging-seq`
- `dex-monitoring-grafana`
- `dex-skill-docker`
- `dex-skill-kubernetes`
- `dex-skill-gitlab-ci`
- `dex-skill-teamcity`
- `dex-skill-observability`

## Installation

Since Claude Code doesn't have native bundle dependency management, install each component separately:

```bash
# Install all components
claude plugins install dex-docker-specialist
claude plugins install dex-kubernetes-specialist
claude plugins install dex-cicd-gitlab
claude plugins install dex-cicd-teamcity
claude plugins install dex-logging-seq
claude plugins install dex-monitoring-grafana
claude plugins install dex-skill-docker
claude plugins install dex-skill-kubernetes
claude plugins install dex-skill-gitlab-ci
claude plugins install dex-skill-teamcity
claude plugins install dex-skill-observability
```

## Note

This bundle is a convenience wrapper. Each component plugin works independently.
