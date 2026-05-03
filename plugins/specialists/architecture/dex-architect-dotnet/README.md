# dex-architect-dotnet

.NET-вариант интерактивного архитектора-интервьюера. Та же методология, что и `dex-architect` (Alex Xu 4-step + RESHADED), но с конкретными ASP.NET Core / EF Core / MassTransit / Polly / Serilog рекомендациями в alternatives и .NET-skills в Deep Dive.

Используется, когда стек проекта явно .NET. Для стек-нейтральных сессий — `dex-architect`.

## Команда

`/design-dotnet <бизнес-задача>` — запустить полную .NET-архитектурную сессию (8 фаз).

## Required skills

Агент императивно загружает skills через Skill tool в фазах. Базовые архитектурные skills + .NET-специфичные. **Обязательно** установить через `dex-bundle-dotnet-developer` или `dex-bundle-dotnet-fullstack` — оба bundle содержат полный набор.

### Базовые архитектурные skills (общие с `dex-architect`)

| Skill | Используется в фазах | Зачем |
|-------|---------------------|-------|
| `dex-skill-nfr` | Phase 1 | NFR completeness, security NFR |
| `dex-skill-capacity-planning` | Phase 2, 6 | Capacity, read:write ratio, hot path |
| `dex-skill-cap-consistency` | Phase 5 | CAP/PACELC + cheatsheet |
| `dex-skill-tech-evaluation` | Phase 5 | Vendor lock-in, license, hidden cost |
| `dex-skill-scalability` | Phase 6 | Sharding, stateless |
| `dex-skill-distributed-resilience` | Phase 6 | CAS, retry, circuit breaker, bulkhead |
| `dex-skill-reference-architectures` | Phase 6 (conditional) | Feed/chat/payment/search/notifications/rate-limiter anti-patterns |
| `dex-skill-api-specification` | Phase 6 | Pagination, idempotency, versioning, ProblemDetails |
| `dex-skill-clean-architecture` | Phase 4, 6 (conditional) | Layers, dependencies |
| `dex-skill-ddd` | Phase 4, 6 (conditional) | Aggregates, bounded contexts |
| `dex-skill-microservices` | Phase 4, 6 (conditional) | Saga, outbox, distributed monolith |
| `dex-skill-owasp-security` | Phase 4, 6 (conditional) | OWASP Top 10 |
| `dex-skill-doc-standards` | Phase 8 (conditional) | Формат ADR |

### .NET-специфичные skills (только у этого агента)

| Skill | Используется в фазах | Зачем |
|-------|---------------------|-------|
| `dex-skill-dotnet-api-development` | Phase 6 | ASP.NET Core controllers, DTO, FluentValidation, pagination |
| `dex-skill-dotnet-resilience` | Phase 6 | Polly: retry с idempotency / jitter, circuit breaker, timeout |
| `dex-skill-dotnet-ef-core` | Phase 6 (conditional) | EF Core: queries, tracking, migrations, owned-types |
| `dex-skill-dotnet-async-patterns` | Phase 6 (conditional) | Async/await, cancellation, ValueTask |
| `dex-skill-dotnet-logging` | Phase 6 (conditional) | Serilog, ILogger, structured logging |
| `dex-skill-dotnet-csproj-hygiene` | Phase 6 (conditional) | CPM, ProjectReference, Directory.Build.props |
| `dex-skill-codebase-conventions` | Phase 4, 6 (conditional) | Соответствие конвенциям существующего проекта |

**Установка одной командой:**

```bash
claude plugins install dex-bundle-dotnet-developer
# или для fullstack-стека с инфраструктурными specialists
claude plugins install dex-bundle-dotnet-fullstack
```

При недоступности skill агент **не останавливается** — помечает в финальном отчёте «фаза N выполнена без проверки skill X», продолжает работу. См. Boundaries → Graceful degradation.

## Связанные плагины

- `dex-architect` — параллельный стек-нейтральный агент (если задача не привязана к .NET)
- `dex-codebase-analyzer` — utility для подготовки контекста репо (`/codebase-summary`, `/codebase-graph`) **до** запуска агента
- `dex-dotnet-coder`, `dex-ef-specialist`, `dex-dotnet-performance` — специалисты для последующей реализации архитектурного плана

## Методология

Та же, что у `dex-architect`: Alex Xu 4-step + RESHADED + reference architectures из system-design-primer и ByteByteGo. .NET-специфика добавляется в Phase 4 (alternatives) и Phase 6 (deep dive).
