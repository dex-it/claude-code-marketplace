# DEX .NET Developer Plugin v4.3

.NET Developer toolkit: coding, debugging, testing, infrastructure, CI/CD, API design.

## Components

**Agents (8):**
- `coding-assistant` - написание кода, SOLID, паттерны
- `bug-hunter` - поиск и исправление багов
- `code-reviewer` - code review, безопасность
- `test-writer` - генерация тестов xUnit/Moq
- `infrastructure-assistant` - PostgreSQL, MongoDB, RabbitMQ, Kafka, Redis, ES, Docker, Grafana, TeamCity
- `performance-analyst` - N+1 detection, profiling, memory leaks, OpenTelemetry traces
- `ci-cd-specialist` - GitLab CI + TeamCity pipelines
- `api-designer` - OpenAPI/Swagger, API versioning

**Commands (17):**
- Build & Test: `/build`, `/test`, `/debug`, `/refactor`
- Database: `/ef-migration`, `/mongo-query`
- Messaging: `/rabbit-status`, `/kafka-status`
- Search: `/es-query`
- Caching: `/redis-cache`
- Containers: `/docker-build`, `/k8s-status`
- Logging: `/logs`
- CI/CD: `/teamcity-status`
- API: `/api-docs`
- Monitoring: `/health-check`, `/metrics`

**Skills (17):**
- Core: `dotnet-patterns`, `ef-core`, `async-patterns`, `linq-optimization`
- API: `api-development`, `api-documentation`
- Testing: `testing-patterns`
- Infrastructure: `rabbitmq-patterns`, `kafka-patterns`, `elasticsearch-patterns`, `redis-patterns`, `mongodb-patterns`
- DevOps: `docker-patterns`, `k8s-patterns`, `teamcity-patterns`
- Observability: `logging-patterns`, `observability-patterns`

**MCP Servers (11):**

| Server | Description | Required |
|--------|-------------|----------|
| GitLab | Source control, MRs | Yes |
| Notion | Documentation | Yes |
| genai-toolbox | PostgreSQL, MongoDB, Elasticsearch, Redis + MySQL, BigQuery, etc. | Optional |
| RabbitMQ | Message queues | Optional |
| Kafka | Topics, consumer groups, lag monitoring | Optional |
| Docker | Containers | Optional |
| Seq | Structured logging | Optional |
| Kubernetes | K8s resources | Optional |
| TeamCity | CI/CD builds | Optional |
| Grafana | Metrics, dashboards | Optional |
| OpenAPI | API documentation | Optional |

**Note:** genai-toolbox - универсальный MCP для баз данных от Google. Конфигурация в `tools.yaml`.
Docs: https://github.com/googleapis/genai-toolbox

## Setup

### Required Environment Variables
```bash
export GITLAB_TOKEN="glpat-xxx"
export NOTION_TOKEN="ntn_xxx"
```

### Database
```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/db"
export MONGODB_URI="mongodb://localhost:27017/dbname"
```

### Search & Logging
```bash
export ELASTICSEARCH_URL="http://localhost:9200"
export ELASTICSEARCH_API_KEY="xxx"
export SEQ_SERVER_URL="http://localhost:5341"
export SEQ_API_KEY="xxx"
```

### CI/CD
```bash
export TEAMCITY_URL="https://teamcity.example.com"
export TEAMCITY_TOKEN="your-api-token"
export MCP_MODE="dev"  # dev (~77 tools) or full (100+ tools with write access)
```

### Monitoring
```bash
export GRAFANA_URL="http://localhost:3000"
export GRAFANA_API_KEY="your-service-account-token"
```

### Messaging & Caching (defaults work for local dev)
```bash
export RABBITMQ_HOST="localhost"
export RABBITMQ_PORT="5672"
export RABBITMQ_USER="guest"
export RABBITMQ_PASSWORD="guest"
export REDIS_URL="redis://localhost:6379/0"
```

### Kubernetes
```bash
export K8S_READONLY="true"  # Recommended for safety
```

### Prerequisites
```bash
# Seq MCP Server
dotnet tool install -g SeqMcpServer
```

## Usage Examples

### Coding
```bash
"Implement repository pattern для User"
"Create API controller для Product"
"Добавь пагинацию в OrderService"
```

### Infrastructure
```bash
/rabbit-status              # RabbitMQ queues status
/kafka-status               # Kafka topics, consumer groups, lag
/es-query products "phone"  # Elasticsearch query
/redis-cache --stats        # Redis statistics
/docker-build --analyze     # Docker build analysis
/k8s-status production      # Kubernetes pods status
/mongo-query orders '{"status": "pending"}'  # MongoDB query
```

### CI/CD
```bash
/teamcity-status           # Build status, agents, queue
"Создай GitLab CI pipeline для .NET 8"
"Настрой TeamCity build configuration"
```

### API Design
```bash
/api-docs                  # Generate OpenAPI spec
"Спроектируй REST API для Order management"
"Добавь версионирование в API"
```

### Monitoring
```bash
/health-check              # Check all services health
/metrics                   # Prometheus/Grafana metrics
/logs --errors --last 1h   # Recent error logs
```

### Performance Analysis
```bash
"Найди N+1 в OrderService"
"Проанализируй trace abc123"
"Проверь cache hit ratio"
```

### Testing & Debug
```bash
/test                      # Run tests
/debug                     # Debug session
"Напиши unit тесты для UserService"
```

## New in v4.1

### New Agents
- **ci-cd-specialist** - GitLab CI + TeamCity integration
- **api-designer** - OpenAPI/Swagger design

### New Commands
- `/teamcity-status` - TeamCity builds, agents, queue
- `/api-docs` - OpenAPI generation and validation
- `/health-check` - Comprehensive system diagnostics
- `/metrics` - Prometheus/Grafana metrics
- `/mongo-query` - MongoDB operations

### New Skills
- **mongodb-patterns** - MongoDB.Driver, BSON, aggregations, transactions
- **teamcity-patterns** - Build configurations, Kotlin DSL, meta-runners
- **api-documentation** - Swashbuckle, NSwag, versioning
- **observability-patterns** - OpenTelemetry, distributed tracing

### Enhanced Components
- **infrastructure-assistant** - Added MongoDB, Grafana, TeamCity support
- **performance-analyst** - Added OpenTelemetry traces, Grafana metrics analysis
- **logging-patterns** - Added OpenTelemetry, Grafana Loki integration

### MCP Changes (v4.2)
- **genai-toolbox** - заменяет 4 отдельных MCP (postgres, mongodb, elasticsearch, redis)
- Единая YAML конфигурация для всех баз данных
- Поддержка дополнительных БД: MySQL, BigQuery, ClickHouse, Oracle, SQL Server

## New in v4.3

### Apache Kafka Support
- **kafka MCP server** - tuannvm/kafka-mcp-server (Go binary via Homebrew)
  - 9 tools: produce_message, consume_messages, list_brokers, describe_topic, list_consumer_groups, describe_consumer_group, describe_configs, cluster_overview, list_topics
  - Enterprise auth: SASL (plain, scram-sha-256, scram-sha-512) + TLS
- **kafka-patterns skill** - Confluent.Kafka, MassTransit Kafka transport, consumer groups, Schema Registry
- **/kafka-status command** - Cluster health, topics, consumer groups, lag monitoring
- **infrastructure-assistant** - Added Kafka triggers and commands

### Installation
```bash
# Install kafka-mcp-server
brew tap tuannvm/mcp
brew install kafka-mcp-server
```

---
**Version:** 4.3.0 | **Author:** DEX Team | **License:** GPL-3.0

**Tags:** dotnet, csharp, ef-core, rabbitmq, kafka, elasticsearch, redis, mongodb, docker, kubernetes, teamcity, grafana, opentelemetry, ci-cd, openapi, swagger
