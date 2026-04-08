# dex-teamcity-cli

TeamCity CLI utility for Claude Code. Quick access to builds, agents, and build logs via REST API.

## Commands

| Command | Description |
|---------|-------------|
| `/tc-builds` | List and inspect builds |
| `/tc-agents` | Check agent status |
| `/tc-logs` | View build logs |

## Requirements

- `curl` and `jq` installed
- Environment variables:
  - `TEAMCITY_URL` -- TeamCity server URL (e.g. `https://teamcity.example.com`)
  - `TEAMCITY_TOKEN` -- API access token

## Installation

```bash
claude plugins install ./plugins/utilities/dex-teamcity-cli
```
