# dex-architect

Узел «дизайн-решение» зоны 2 (system design) по методологии Alex Xu (4-step) и RESHADED: reference
architecture match (consumer-scale + enterprise/internal-tooling), 2-3 альтернативы, решение с
CAP/PACELC trade-off'ами, deep dive по storage / API / caching / sharding / failure modes /
security controls / observability. Требования, capacity, implementation-план и документацию
(ADR/API-spec/диаграммы) ведёт вызывающий трек `dex-skill-architecture-track:architecture-track`
(команда `/design` в `dex-sdlc`) — этот агент получает их уже готовыми на входе, не выясняет сам.

Стек-нейтральный. Для .NET-сессий с конкретными ASP.NET Core / EF Core / MassTransit / Polly / Serilog рекомендациями — `dex-architect-dotnet`.

## Команда

`/review-arch` — точечное ревью архитектуры уже реализованного кода (не через architecture-track: другой вход — код, не бизнес-задача). Полную дизайн-сессию от требований до одобренного документа запускает `/design` из `dex-sdlc`.

## Required skills

Агент императивно загружает skills через Skill tool в фазах. Все они **обязательно** должны быть установлены отдельно или — рекомендуется — через `dex-bundle-architect`, который содержит их в актуальных версиях.

| Skill | Используется в фазах | Зачем |
|-------|---------------------|-------|
| `dex-skill-clean-architecture` | Phase 2, 4 (conditional) | Layers, dependencies, transactional boundaries |
| `dex-skill-ddd` | Phase 2, 4 (conditional) | Aggregates, value objects, bounded contexts |
| `dex-skill-microservices` | Phase 2, 4 (conditional) | Saga, outbox, distributed monolith, service communication |
| `dex-skill-owasp-security` | Phase 2, 4 (conditional) | OWASP Top 10 в архитектурных решениях (IDOR, SSRF, broken auth) |
| `dex-skill-cap-consistency` | Phase 3 | CAP/PACELC trade-offs, quorum, split-brain, clock skew, saga compensation + PACELC defaults cheatsheet |
| `dex-skill-tech-evaluation` | Phase 3 | Hype-driven adoption, vendor lock-in, license, hidden cost, team expertise |
| `dex-skill-capacity-planning` | Phase 4 | Peak vs average, write amplification, read:write ratio, cache cost, hot path |
| `dex-skill-scalability` | Phase 4 | Sharding key, stateless, hot partition, cross-shard queries |
| `dex-skill-distributed-resilience` | Phase 4 | CAS, optimistic locking, retry budget, idempotency, circuit breaker, bulkheads, health checks |
| `dex-skill-api-specification` | Phase 4 | Pagination, idempotency, versioning, ProblemDetails |
| `dex-skill-reference-architectures` | Phase 4 (conditional) | Anti-patterns выбора feed/chat/payment/search/notifications/rate-limiter |

**Установка одной командой:**

```bash
claude plugins install dex-bundle-architect
```

Если ставить только агент без bundle:

```bash
claude plugins install dex-architect
# затем явно установить нужные skills
```

При недоступности skill агент **не останавливается** — помечает в финальном отчёте «фаза N выполнена без проверки skill X», продолжает работу. См. Boundaries → Graceful degradation.

## Связанные плагины

- `dex-skill-architecture-track` — трек, который вызывает этого агента: ведёт требования, capacity, implementation-план, диспетчинг документации и приёмку design-reviewer вокруг Phase 1-4 этого узла
- `dex-architect-dotnet` — параллельный агент с .NET-конкретикой (ASP.NET Core, EF Core, MassTransit, Polly, Serilog) и .NET-skills в Deep Dive
- `dex-codebase-analyzer` — utility для подготовки контекста репо (`/codebase-summary`, `/codebase-graph`) **до** запуска агента
- `dex-adr-writer`, `dex-api-designer`, `dex-diagram-creator` — узлы документации, вызывает трек в своей Phase 5 (Document) по решению этого агента
- `dex-design-reviewer` — приёмка design-документа, вызывает трек в своей Phase 6 (Design Acceptance)

## Методология

- **Alex Xu — System Design Interview vol. 1 + 2** — 4-step framework (Understand → High-level → Deep-dive → Wrap-up)
- **RESHADED** (Educative) — Requirements → Estimation → Storage → APIs → Detailed → Evaluation → Done
- **Donne Martin — system-design-primer** — 40+ reference architectures
- **ByteByteGo** — back-of-envelope, CAP/PACELC cheatsheets
