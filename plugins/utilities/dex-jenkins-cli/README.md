# dex-jenkins-cli

Jenkins CLI utility for Claude Code. Quick access to jobs, builds, and console output via REST API.

## Commands

| Command | Description |
|---------|-------------|
| `/jk-jobs` | List and inspect jobs |
| `/jk-builds` | View build details |
| `/jk-logs` | View console output |

## Requirements

- `curl` and `jq` installed
- Environment variables:
  - `JENKINS_URL` -- Jenkins server URL (e.g. `https://jenkins.example.com`)
  - `JENKINS_USER` -- Jenkins username
  - `JENKINS_API_TOKEN` -- API token (generate at `$JENKINS_URL/me/configure`)

## Installation

```bash
claude plugins install ./plugins/utilities/dex-jenkins-cli
```
