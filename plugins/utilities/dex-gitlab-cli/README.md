# dex-gitlab-cli

GitLab CLI utility for Claude Code. Quick access to pipelines, merge requests, and CI job logs via `glab`.

## Commands

| Command | Description |
|---------|-------------|
| `/gl-pipelines` | List and inspect GitLab CI pipelines |
| `/gl-mrs` | List and inspect merge requests |
| `/gl-logs` | View CI job logs |

## Requirements

- [glab](https://gitlab.com/gitlab-org/cli) CLI installed and authenticated
- Run `glab auth login` to authenticate

## Installation

```bash
claude plugins install ./plugins/utilities/dex-gitlab-cli
```
