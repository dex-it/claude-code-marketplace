# dex-kubectl-cli

Kubernetes CLI utility for Claude Code. Quick access to pods, logs, deployments, and cluster events via `kubectl`.

## Commands

| Command | Description |
|---------|-------------|
| `/kube-pods` | List and inspect pod status |
| `/kube-logs` | View pod/container logs |
| `/kube-deploy` | Inspect deployments and rollout status |
| `/kube-events` | View cluster events |

## Requirements

- [kubectl](https://kubernetes.io/docs/tasks/tools/) installed and configured with cluster access

## Installation

```bash
claude plugins install ./plugins/utilities/dex-kubectl-cli
```
