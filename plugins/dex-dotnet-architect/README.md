# DEX .NET Architect Plugin

> Comprehensive .NET Architect toolkit для Clean Architecture, DDD, Microservices, ADR и C4 diagrams.

## Описание

Plugin для .NET архитекторов. Предоставляет AI-ассистентов, команды и best practices для:

- Clean Architecture patterns
- Domain-Driven Design (DDD)
- Microservices architecture
- Architecture Decision Records (ADR)
- C4 diagrams (Context, Container, Component, Code)
- CQRS + Event Sourcing

## Компоненты

### 🤖 Agents

**architect** - Архитектурное проектирование
- Solution architecture design
- Technology stack recommendations
- Scalability considerations
- Security architecture
- Performance optimization
- Triggers: `архитектура`, `design architecture`, `проектирование`, `tech stack`

**adr-writer** - Architecture Decision Records
- ADR documentation creation
- Decision context analysis
- Alternatives evaluation
- Consequences documentation
- ADR management
- Triggers: `adr`, `decision record`, `architecture decision`, `решение по архитектуре`

**diagram-creator** - Architecture Diagrams
- C4 diagrams (Context, Container, Component)
- Sequence diagrams
- System architecture visualization
- PlantUML/Mermaid generation
- Triggers: `diagram`, `c4`, `диаграмма`, `визуализация архитектуры`

### ⚡ Commands

**`/design`** - Архитектурное проектирование
```
Помощь в проектировании архитектуры:
- Solution structure recommendations
- Layer separation (Presentation, Application, Domain, Infrastructure)
- Technology choices
- Scalability planning
- Security considerations
```

**`/adr`** - Создание ADR
```
Генерирует Architecture Decision Record:
- Title и Status
- Context (problem statement)
- Decision (chosen solution)
- Alternatives considered
- Consequences (positive, negative)
- Saves to docs/adr/ or Notion
```

**`/review`** - Architecture Review
```
Проводит architecture review:
- Identifies architectural smells
- Dependency analysis
- Coupling/cohesion assessment
- Best practices validation
- Improvement recommendations
```

### 🎯 Skills

**clean-architecture** - Clean Architecture patterns
```
Активируется при:
- Layered architecture design
- Dependency inversion
- Use cases implementation
- Entity modeling

Включает:
- Layers: Presentation, Application, Domain, Infrastructure
- Dependency Rule (inner layers не знают о outer)
- Use Cases (Application layer)
- Entities (Domain layer)
- Interfaces и abstractions
- Dependency Injection patterns
```

**ddd-patterns** - Domain-Driven Design
```
Активируется при:
- Aggregate design
- Value Objects
- Domain Events
- Repository patterns

Включает:
- Bounded Contexts
- Aggregates и Aggregate Roots
- Value Objects vs Entities
- Domain Events
- Repositories (interface в Domain, implementation в Infrastructure)
- Ubiquitous Language
```

**microservices** - Microservices Architecture
```
Активируется при:
- Service decomposition
- API Gateway patterns
- Service communication
- Data consistency

Включает:
- Service boundaries
- API Gateway (Ocelot, YARP)
- Inter-service communication (REST, gRPC, Message Broker)
- Database per service
- Saga pattern (distributed transactions)
- Service discovery
- Circuit Breaker (Polly)
```

**cqrs-event-sourcing** - CQRS + Event Sourcing
```
Активируется при:
- Command/Query separation
- Event-driven architecture
- Eventual consistency

Включает:
- CQRS pattern (separate read/write models)
- Command handlers
- Query handlers
- Event Sourcing (events as source of truth)
- Projections (read models)
- MediatR library usage
- Event Store patterns
```

### 📝 System Prompt

.NET Architect system prompt с:
- Architectural principles (SOLID, DRY, YAGNI)
- Design patterns (Gang of Four, Enterprise patterns)
- Scalability и performance best practices
- Security considerations
- Cloud-native patterns

## Configuration

This plugin requires multiple MCP servers to be configured with environment variables.

### Required Environment Variables

**GitHub Integration**
- `GITHUB_TOKEN` - GitHub Personal Access Token
  - Get from: https://github.com/settings/tokens
  - Scopes: `repo`, `read:org`
  - Required for: ADR storage, diagram versioning

**GitLab Integration**
- `GITLAB_TOKEN` - GitLab Personal Access Token
  - Get from: https://gitlab.com/-/user_settings/personal_access_tokens
  - Scopes: `api`, `read_repository`, `write_repository`
  - Required for: Code analysis, architecture review

**Notion Integration**
- `NOTION_TOKEN` - Notion API token (Internal Integration Token)
  - Get from: https://www.notion.so/my-integrations
  - Required for: ADR documentation, architecture documentation

### Setup Instructions

1. **Create tokens:**
   - **GitHub**: https://github.com/settings/tokens
   - **GitLab**: https://gitlab.com/-/user_settings/personal_access_tokens
   - **Notion**: https://www.notion.so/my-integrations

2. **Set environment variables:**
   ```bash
   export GITHUB_TOKEN="ghp_xxxxxxxxxxxxx"
   export GITLAB_TOKEN="glpat-xxxxxxxxxxxxx"
   export GITLAB_API_URL="https://gitlab.com/api/v4"  # Optional
   export NOTION_TOKEN="ntn_xxxxxxxxxxxxx"
   ```

3. **Verify configuration:**
   ```bash
   claude
   /mcp list
   ```

## Quick Start

### 1. Установка

```bash
# Скопируйте плагин в .claude/plugins/
cp -r dex-dotnet-architect ~/.claude/plugins/

# Или через marketplace (когда доступно)
claude plugin install dex-dotnet-architect
```

### 2. Configuration

See the **[Configuration](#configuration)** section above for detailed setup instructions.

### 3. Использование

**Architecture Design:**
```
/design                          # Interactive architecture design
"Спроектируй Clean Architecture для e-commerce"
"Микросервисная архитектура для order processing"
"Выбери tech stack для high-load API"
```

**ADR Creation:**
```
/adr                             # Create ADR
"Создай ADR для выбора message broker"
"Document decision: PostgreSQL vs MongoDB"
```

**Architecture Review:**
```
/review                          # Review architecture
"Проверь архитектуру на best practices"
"Найди архитектурные проблемы в solution"
```

**Diagrams:**
```
"Создай C4 Context diagram для системы"
"Generate sequence diagram для checkout flow"
"PlantUML diagram для service interactions"
```

## Best Practices

### Clean Architecture

✅ **DO:**
- Follow Dependency Rule (inner → outer, never outer → inner)
- Keep Domain layer pure (no external dependencies)
- Use interfaces для abstractions
- Application layer orchestrates Use Cases
- Infrastructure implements interfaces

❌ **DON'T:**
- Domain зависит от Infrastructure
- Business logic в Controllers
- Direct database access в Application layer
- Leaking infrastructure concerns в Domain
- Circular dependencies between layers

### Domain-Driven Design

✅ **DO:**
- Model rich domain entities
- Use Ubiquitous Language
- Define clear Bounded Contexts
- Aggregates enforce invariants
- Value Objects для immutable concepts
- Domain Events для side effects

❌ **DON'T:**
- Anemic domain models (только getters/setters)
- Large Aggregates (performance issues)
- Public setters на entities
- Cross-Aggregate transactions
- Bypass Aggregate Root
- Technical language вместо business terms

### Microservices

✅ **DO:**
- Single Responsibility per service
- Database per service
- API Gateway для external access
- Asynchronous communication (events)
- Circuit Breaker для resilience
- Service mesh для observability

❌ **DON'T:**
- Shared database between services
- Distributed monolith (tight coupling)
- Synchronous call chains
- Forget idempotency
- No retry policies
- Missing health checks

### ADR

✅ **DO:**
- Document significant decisions
- Include context и alternatives
- List consequences
- Use ADR template consistently
- Version control ADRs
- Link related ADRs

❌ **DON'T:**
- Document trivial decisions
- Skip alternatives section
- Forget to update status
- Delete old ADRs (mark as superseded)
- Missing date и author
- Vague decision descriptions

## Clean Architecture Structure

```
Solution/
├── src/
│   ├── Domain/                          # Core business logic
│   │   ├── Entities/
│   │   ├── ValueObjects/
│   │   ├── Events/
│   │   ├── Exceptions/
│   │   └── Interfaces/                  # Repository interfaces
│   │
│   ├── Application/                     # Use cases
│   │   ├── UseCases/
│   │   │   ├── CreateOrder/
│   │   │   │   ├── CreateOrderCommand.cs
│   │   │   │   └── CreateOrderHandler.cs
│   │   ├── DTOs/
│   │   ├── Interfaces/                  # Service interfaces
│   │   └── Common/
│   │
│   ├── Infrastructure/                  # External concerns
│   │   ├── Persistence/
│   │   │   ├── AppDbContext.cs
│   │   │   └── Repositories/
│   │   ├── Identity/
│   │   ├── Services/
│   │   └── Configuration/
│   │
│   └── Presentation/                    # API/UI
│       ├── Controllers/
│       ├── Middlewares/
│       └── Program.cs
│
├── tests/
│   ├── Domain.Tests/
│   ├── Application.Tests/
│   └── Infrastructure.Tests/
│
└── docs/
    └── adr/                             # Architecture Decision Records
        ├── 0001-use-clean-architecture.md
        └── 0002-choose-postgresql.md
```

## ADR Template

```markdown
# ADR-0001: [Title]

**Status:** Proposed | Accepted | Deprecated | Superseded

**Date:** 2024-11-26

**Decision Makers:** [Names]

**Technical Story:** [Jira/GitLab Issue]

## Context

[Describe the problem and why a decision needs to be made]

## Decision

[Describe the chosen solution]

## Alternatives Considered

### Alternative 1: [Name]
**Pros:**
- [Advantage 1]
- [Advantage 2]

**Cons:**
- [Disadvantage 1]
- [Disadvantage 2]

### Alternative 2: [Name]
[Same structure]

## Consequences

**Positive:**
- [Benefit 1]
- [Benefit 2]

**Negative:**
- [Cost/Risk 1]
- [Cost/Risk 2]

**Neutral:**
- [Neutral impact 1]

## Implementation Notes

[Technical details, migration path, etc.]

## References

- [Link to documentation]
- [Related ADRs]
```

## C4 Diagram Example

```plantuml
@startuml C4_Context
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Context.puml

LAYOUT_WITH_LEGEND()

title System Context diagram for E-Commerce Platform

Person(customer, "Customer", "A customer of the e-commerce platform")
Person(admin, "Administrator", "Platform administrator")

System(ecommerce, "E-Commerce Platform", "Allows customers to browse and purchase products")

System_Ext(payment, "Payment Gateway", "Processes payments")
System_Ext(shipping, "Shipping Provider", "Handles order delivery")
System_Ext(email, "Email Service", "Sends notifications")

Rel(customer, ecommerce, "Browses products, places orders")
Rel(admin, ecommerce, "Manages products, orders")
Rel(ecommerce, payment, "Processes payments")
Rel(ecommerce, shipping, "Arranges delivery")
Rel(ecommerce, email, "Sends notifications")

@enduml
```

## Integration с .NET Workflow

Этот плагин designed для .NET команд:

- **GitHub/GitLab**: ADR versioning, code analysis
- **Notion**: Architecture documentation, decision tracking
- **Filesystem**: Local diagram files, documentation

Example workflow:
```
1. Define architectural requirements
2. Design architecture (/design)
3. Create C4 diagrams
4. Document decisions (/adr)
5. Review architecture (/review)
6. Iterate based on feedback
7. Update diagrams и ADRs
8. Share documentation (Notion/GitLab)
```

## Troubleshooting

**ADR не сохраняется:**
```bash
# Check if docs/adr directory exists
mkdir -p docs/adr

# Verify write permissions
ls -la docs/adr
```

**Diagram generation fails:**
```bash
# Install PlantUML
brew install plantuml  # macOS
apt install plantuml   # Linux

# Generate diagram
plantuml diagram.puml
```

## Roadmap

- [ ] Automated architecture analysis (ArchUnit.NET)
- [ ] Dependency graph generation
- [ ] Architecture fitness functions
- [ ] Cloud architecture patterns (Azure, AWS)
- [ ] Event Storming templates
- [ ] Architecture kata library

## License

См. корневой LICENSE файл проекта.

---

**Version:** 2.0.0
**Author:** DEX Team
**Requires:** GitHub MCP, GitLab MCP, Notion MCP, Filesystem MCP
**Tags:** architect, clean-architecture, ddd, microservices, adr, c4-diagrams
