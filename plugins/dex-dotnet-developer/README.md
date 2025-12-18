# DEX .NET Developer Plugin v3.0

.NET Developer toolkit: coding, debugging, testing, infrastructure.

## Components

**Agents (6):** coding-assistant, bug-hunter, code-reviewer, test-writer, infrastructure-assistant, performance-analyst

**Commands (11):** /build, /test, /debug, /ef-migration, /refactor, /rabbit-status, /es-query, /redis-cache, /docker-build, /logs, /k8s-status

**Skills (12):** dotnet-patterns, ef-core, async-patterns, linq-optimization, api-development, testing-patterns, rabbitmq-patterns, elasticsearch-patterns, redis-patterns, docker-patterns, logging-patterns, k8s-patterns

**MCP (9):** GitLab, PostgreSQL, Notion, RabbitMQ, Elasticsearch, Redis, Docker, Seq, Kubernetes

## Setup

### Required
```bash
export GITLAB_TOKEN="glpat-xxx"
export NOTION_TOKEN="ntn_xxx"
export DATABASE_URL="postgresql://user:pass@localhost:5432/db"
export ELASTICSEARCH_URL="http://localhost:9200"
export ELASTICSEARCH_API_KEY="xxx"
export SEQ_SERVER_URL="http://localhost:5341"
export SEQ_API_KEY="xxx"
```

### Optional (defaults work for local dev)
```bash
export RABBITMQ_HOST="localhost"
export REDIS_URL="redis://localhost:6379/0"
export K8S_READONLY="false"
```

### Prerequisites
```bash
dotnet tool install -g SeqMcpServer
```

## Usage

```bash
# Coding
"Implement repository pattern для User"
"Create API controller для Product"

# Infrastructure
/rabbit-status
/es-query products "phone"
/redis-cache --stats
/docker-build --analyze
/logs --errors
/k8s-status production

# Testing & Debug
/test
/debug
"Найди N+1 в OrderService"
```

---
**Version:** 3.0.0 | **Author:** DEX Team | **Tags:** dotnet, csharp, ef-core, rabbitmq, elasticsearch, redis, docker, kubernetes
