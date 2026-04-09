# dex-github-cli

GitHub CLI utility for Claude Code. Quick access to workflow runs, pull requests, and Actions logs via `gh`.

## Commands

| Command | Description |
|---------|-------------|
| `/gh-runs` | List and inspect GitHub Actions workflow runs |
| `/gh-prs` | List and inspect pull requests |
| `/gh-logs` | View Actions run logs |

## Requirements

- [gh](https://cli.github.com/) CLI installed and authenticated
- Run `gh auth login` to authenticate

## Installation

```bash
claude plugins install ./plugins/utilities/dex-github-cli
```
