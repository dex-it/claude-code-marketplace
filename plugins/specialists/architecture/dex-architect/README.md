# dex-architect

Интерактивный архитектор-интервьюер по методологии Alex Xu (4-step) и RESHADED. Принимает бизнес-задачу на естественном языке, ведёт пользователя через структурированную system-design-сессию: интервью требований (с security-вопросами), back-of-envelope estimation, матч с reference architectures (consumer-scale + enterprise/internal-tooling), 2-3 альтернативы с CAP/PACELC trade-off'ами, deep dive по storage / API / caching / sharding / failure modes / security controls / observability и implementation plan.

Стек-нейтральный. Для .NET-сессий с конкретными ASP.NET Core / EF Core / MassTransit / Polly / Serilog рекомендациями — `dex-architect-dotnet`.

## Команда

`/design <бизнес-задача>` — запустить полную архитектурную сессию (8 фаз).

## Required skills

Агент императивно загружает skills через Skill tool в фазах. Все они **обязательно** должны быть установлены отдельно или — рекомендуется — через `dex-bundle-architect`, который содержит их в актуальных версиях.

| Skill | Используется в фазах | Зачем |
|-------|---------------------|-------|
| `dex-skill-nfr` | Phase 1 | NFR completeness, security NFR (data classification, authz, secrets, audit, IDOR, multi-tenant) |
| `dex-skill-capacity-planning` | Phase 2, 6 | Peak vs average, write amplification, read:write ratio, cache cost, hot path |
| `dex-skill-cap-consistency` | Phase 5 | CAP/PACELC trade-offs, quorum, split-brain, clock skew, saga compensation + PACELC defaults cheatsheet |
| `dex-skill-tech-evaluation` | Phase 5 | Hype-driven adoption, vendor lock-in, license, hidden cost, team expertise |
| `dex-skill-scalability` | Phase 6 | Sharding key, stateless, hot partition, cross-shard queries |
| `dex-skill-distributed-resilience` | Phase 6 | CAS, optimistic locking, retry budget, idempotency, circuit breaker, bulkheads, health checks |
| `dex-skill-reference-architectures` | Phase 6 (conditional) | Anti-patterns выбора feed/chat/payment/search/notifications/rate-limiter |
| `dex-skill-api-specification` | Phase 6 | Pagination, idempotency, versioning, ProblemDetails |
| `dex-skill-clean-architecture` | Phase 4, 6 (conditional) | Layers, dependencies, transactional boundaries |
| `dex-skill-ddd` | Phase 4, 6 (conditional) | Aggregates, value objects, bounded contexts |
| `dex-skill-microservices` | Phase 4, 6 (conditional) | Saga, outbox, distributed monolith, service communication |
| `dex-skill-owasp-security` | Phase 4, 6 (conditional) | OWASP Top 10 в архитектурных решениях (IDOR, SSRF, broken auth) |
| `dex-skill-doc-standards` | Phase 8 (conditional) | Формат ADR (MADR / Nygard) |

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

- `dex-architect-dotnet` — параллельный агент с .NET-конкретикой (ASP.NET Core, EF Core, MassTransit, Polly, Serilog) и .NET-skills в Deep Dive
- `dex-codebase-analyzer` — utility для подготовки контекста репо (`/codebase-summary`, `/codebase-graph`) **до** запуска агента
- `dex-adr-writer` — отдельный агент для оформления ADR (можно вызвать после Phase 5 архитектора, если нужен полноценный ADR-документ)
- `dex-diagram-creator` — отдельный агент для C4-диаграмм (если нужны более детальные диаграммы, чем Mermaid в Phase 4)

## Методология

- **Alex Xu — System Design Interview vol. 1 + 2** — 4-step framework (Understand → High-level → Deep-dive → Wrap-up)
- **RESHADED** (Educative) — Requirements → Estimation → Storage → APIs → Detailed → Evaluation → Done
- **Donne Martin — system-design-primer** — 40+ reference architectures
- **ByteByteGo** — back-of-envelope, CAP/PACELC cheatsheets
