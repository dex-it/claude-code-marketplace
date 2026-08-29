# dex-architect-dotnet

.NET-вариант узла «дизайн-решение» зоны дизайна. Та же методология, что и `dex-architect` (Alex Xu 4-step
+ RESHADED), но с конкретными ASP.NET Core / EF Core / MassTransit / Polly / Serilog
рекомендациями в alternatives, .NET-skills и fact-check библиотек в Deep Dive. Требования,
capacity, implementation-план и документацию ведёт вызывающий трек
`dex-skill-architecture-track:architecture-track` (команда `/design` в `dex-sdlc`) - этот агент
получает их уже готовыми на входе.

Используется, когда стек проекта явно .NET (выбор между этим узлом и `dex-architect` делает трек по
манифесту, не пользователь напрямую). Для стек-нейтральных сессий - `dex-architect`.

## Required skills

Агент императивно загружает skills через Skill tool в фазах. Базовые архитектурные skills + .NET-специфичные. **Обязательно** установить через `dex-bundle-dotnet-developer` или `dex-bundle-dotnet-fullstack` - оба bundle содержат полный набор.

### Базовые архитектурные skills (общие с `dex-architect`)

| Skill | Используется в фазах | Зачем |
|-------|---------------------|-------|
| `dex-skill-clean-architecture` | Phase 2, 4 (conditional) | Layers, dependencies |
| `dex-skill-ddd` | Phase 2, 4 (conditional) | Aggregates, bounded contexts |
| `dex-skill-microservices` | Phase 2, 4 (conditional) | Saga, outbox, distributed monolith |
| `dex-skill-owasp-security` | Phase 2, 4 (conditional) | OWASP Top 10 |
| `dex-skill-cap-consistency` | Phase 3 | CAP/PACELC + cheatsheet |
| `dex-skill-tech-evaluation` | Phase 3 | Vendor lock-in, license, hidden cost |
| `dex-skill-capacity-planning` | Phase 4 | Capacity, read:write ratio, hot path |
| `dex-skill-scalability` | Phase 4 | Sharding, stateless |
| `dex-skill-distributed-resilience` | Phase 4 | CAS, retry, circuit breaker, bulkhead |
| `dex-skill-api-specification` | Phase 4 | Pagination, idempotency, versioning, ProblemDetails |
| `dex-skill-reference-architectures` | Phase 4 (conditional) | Feed/chat/payment/search/notifications/rate-limiter anti-patterns |

### .NET-специфичные skills (только у этого агента)

| Skill | Используется в фазах | Зачем |
|-------|---------------------|-------|
| `dex-skill-dotnet-api-development` | Phase 4 | ASP.NET Core controllers, DTO, FluentValidation, pagination |
| `dex-skill-dotnet-resilience` | Phase 4 | Polly: retry с idempotency / jitter, circuit breaker, timeout |
| `dex-skill-dotnet-ef-core` | Phase 4 (conditional) | EF Core: queries, tracking, migrations, owned-types |
| `dex-skill-dotnet-async-patterns` | Phase 4 (conditional) | Async/await, cancellation, ValueTask |
| `dex-skill-dotnet-logging` | Phase 4 (conditional) | Serilog, ILogger, structured logging |
| `dex-skill-dotnet-csproj-hygiene` | Phase 4 (conditional) | CPM, ProjectReference, Directory.Build.props |
| `dex-skill-dotnet-code-quality` | Phase 4 (conditional) | Roslyn analyzers, warning-профиль, NuGet audit |
| `dex-skill-project-baseline` | Phase 4 (conditional) | Baseline нового проекта: наследовать solution / закладка с нуля |
| `dex-skill-dotnet-config-hygiene` | Phase 4 (conditional) | Конфигурация и секреты нового сервиса |
| `dex-skill-codebase-conventions` | Phase 2, 4 (conditional) | Соответствие конвенциям существующего проекта |
| `dex-skill-fact-verification` | Phase 2, 4 (conditional) | Fact-check имени пакета / API против манифеста проекта |

**Установка одной командой:**

```bash
claude plugins install dex-bundle-dotnet-developer
# или для fullstack-стека с инфраструктурными specialists
claude plugins install dex-bundle-dotnet-fullstack
```

При недоступности skill агент **не останавливается** - помечает в финальном отчёте «фаза N выполнена без проверки skill X», продолжает работу. См. Boundaries -> Graceful degradation.

## Связанные плагины

- `dex-skill-architecture-track` - трек, который вызывает этого агента: ведёт требования, capacity, implementation-план, диспетчинг документации и приёмку design-reviewer вокруг Phase 1-4 этого узла
- `dex-architect` - параллельный стек-нейтральный агент (если задача не привязана к .NET)
- `dex-codebase-analyzer` - utility для подготовки контекста репо (`/codebase-summary`, `/codebase-graph`) **до** запуска агента
- `dex-dotnet-coder`, `dex-ef-specialist`, `dex-dotnet-performance` - специалисты для последующей реализации архитектурного плана

## Методология

Та же, что у `dex-architect`: Alex Xu 4-step + RESHADED + reference architectures из system-design-primer и ByteByteGo. .NET-специфика добавляется в Phase 2 (alternatives) и Phase 4 (deep dive).
