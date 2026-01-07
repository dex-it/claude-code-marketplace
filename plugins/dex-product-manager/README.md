# DEX Product Manager Plugin

> Comprehensive Product Manager toolkit для стратегического планирования, epic management, roadmap и метрик. **Работает на уровне business value и strategic priorities.**

## Описание

Plugin для Product Manager'ов, работающих с .NET командами. Фокус на **strategic level** - epics, roadmap, business requirements, metrics. User stories и технические детали - это работа System Analyst.

Предоставляет AI-ассистентов, команды и best practices для:

- **Business Requirements** - формализация бизнес-идей в конкретные цели
- **Epic Planning** - создание epics с business value и success metrics
- **Roadmap Planning** - квартальное/годовое стратегическое планирование
- **Strategic Prioritization** - RICE scoring, OKR alignment
- **Metrics Analysis** - KPIs, analytics, data-driven decisions

**НЕ включает:**
- ❌ User Story writing (это System Analyst)
- ❌ Acceptance Criteria (это System Analyst)
- ❌ Технические спецификации (это System Analyst)

## Компоненты

### 🤖 Agents

**business-requirements-analyst** - Формализация бизнес-требований
- Преобразование бизнес-идей в конкретные цели
- Анализ use cases и value proposition
- Критический анализ с выявлением рисков
- Декомпозиция high-level целей в implementation stages
- Создание BRD: stakeholders, данные, интеграции, критерии успеха
- Triggers: `бизнес требования`, `business requirements`, `формализовать идею`, `план реализации`

**roadmap-planner** - Стратегическое планирование roadmap
- Quarterly/yearly roadmap creation
- Themes и strategic initiatives
- OKR alignment и business outcomes
- Epic-level planning (НЕ детальные stories)
- Stakeholder communication
- Triggers: `roadmap`, `план развития`, `product roadmap`, `стратегия продукта`

**backlog-manager** - Управление epic-level backlog
- Epic backlog grooming (НЕ story-level)
- RICE/ICE scoring для epics
- Приоритизация на strategic level
- Epic readiness для SA decomposition
- Backlog health metrics
- Triggers: `backlog`, `бэклог`, `приоритизация`, `prioritize`, `refinement`

**metrics-analyst** - Анализ продуктовых метрик
- KPI tracking и dashboards
- AARRR metrics (Acquisition, Activation, Retention, Revenue, Referral)
- A/B testing design и analysis
- Cohort, funnel, retention analysis
- Data-driven decision support
- Triggers: `метрики`, `metrics`, `analytics`, `KPI`, `аналитика`

### ⚡ Commands

**`/create-epic`** - Создание epic в Notion
```
Создаёт properly structured epic:
- Problem statement
- Business value
- Success metrics
- RICE scoring
- User stories (high-level)
- Links к roadmap
```


**`/release-notes`** - Генерация release notes
```
Автоматическое создание release notes:
- Fetches completed items (Notion/Git)
- Groups по categories (Features, Improvements, Bugs)
- User-friendly language
- Multiple formats (customer, internal, technical)
```

### 🎯 Skills

**agile-fundamentals** (shared) - Базовые Agile концепции
```
Shared skill для PM и SA ролей
Активируется при: Agile planning, role clarification

Включает:
- Agile иерархия: Portfolio → Initiative → Epic → Story → Task
- INVEST criteria
- Definition of Ready/Done
- Story sizing reference
- PM vs SA responsibilities
```

**product-discovery** - Discovery techniques
```
Активируется при:
- Customer research и problem validation
- Solution validation и problem-solution fit
- Jobs-to-be-Done framework
- Opportunity Solution Tree

Включает:
- Interview frameworks и user research
- Validation techniques (assumption testing)
- Research templates и synthesis
```

**epic-planning** - Epic structure и planning
```
Активируется при:
- Epic creation и management
- High-level scope definition
- Business value documentation
- Success metrics establishment

Включает:
- Epic template (Problem, Value, Metrics, Scope)
- Epic sizing (S/M/L/XL, T-shirt)
- PM-SA handoff process
- Epic decomposition readiness
- Epic-level DoD

НЕ включает:
- User story writing (см. SA: user-stories skill)
- Acceptance criteria (см. SA: user-stories skill)
```

**doc-worker** - Product documentation principles
```
Активируется при:
- Работа с документацией (BRD, PRD, ADR, notes, research)
- Создание и организация продуктовых документов
- Управление иерархией и связями документов

Включает:
- Search-first подход (избежание дублей)
- Шаблоны документов (BRD/PRD/ADR)
- Metadata и frontmatter структура
- Best practices для Notion/Confluence/Markdown
```

**prioritization** - Strategic prioritization frameworks
```
Активируется при:
- Приоритизация backlog или roadmap
- RICE/ICE scoring
- Feature ranking и сравнение альтернатив

Включает:
- RICE framework (Reach × Impact × Confidence / Effort)
- ICE scoring (quick alternative)
- MoSCoW method (Must/Should/Could/Won't)
- Value vs Effort matrix
- Kano model для user satisfaction
- Notion integration формулы
```

## Configuration

This plugin requires Notion MCP server to be configured with environment variables.

### Required Environment Variables

**Notion Integration**
- `NOTION_TOKEN` - Notion API token (Internal Integration Token)
  - Get from: https://www.notion.so/my-integrations
  - Required for: Roadmap planning, backlog management, documentation

### Setup Instructions

1. **Create Notion Integration:**
   - Open https://www.notion.so/my-integrations
   - Click "Create New Integration"
   - Give it a name (e.g., "Claude Code - Product Manager")
   - Copy the "Internal Integration Token"

2. **Share Notion pages** with your integration:
   - Open the Notion page/database you want to use
   - Click "Share" → "Invite"
   - Select your integration

3. **Set environment variable:**
   ```bash
   export NOTION_TOKEN="ntn_xxxxxxxxxxxxx"
   ```

4. **Verify configuration:**
   ```bash
   claude
   /mcp list
   ```

## Quick Start

### 1. Установка

```bash
# Скопируйте плагин в .claude/plugins/
cp -r dex-product-manager ~/.claude/plugins/

# Или через marketplace (когда доступно)
claude plugin install dex-product-manager
```

### 2. Configuration

See the **[Configuration](#configuration)** section above for detailed Notion setup instructions.

### 3. Использование

**Roadmap Planning:**
```
"Создай roadmap на Q1-Q2 2025"
"Добавь новую initiative в roadmap"
"План развития продукта на год"
```

**Backlog Management:**
```
"Приоритизируй backlog"      # backlog-manager agent + prioritization skill
"Приоритизируй новые items"
"Подготовь stories к sprint planning"
"Проведи backlog cleanup"
```

**Epic Creation:**
```
/create-epic                 # Интерактивное создание
/create-epic "Mobile App Redesign"
"Создай epic для payment integration"
```

**Metrics Analysis:**
```
"Проанализируй метрики за последний месяц"
"Какие KPI для feature X?"
"Почему retention упал?"
"Создай metrics dashboard"
```

**Release Notes:**
```
/release-notes               # За последний sprint
"Создай release notes для v2.5.0"
"Release notes с 1 марта по 15 марта"
```

## Frameworks & Best Practices

### RICE Prioritization

```
RICE = (Reach × Impact × Confidence) / Effort

Reach: пользователи затронутые per quarter (число)
Impact: 0.25 (minimal) → 3 (massive)
Confidence: 50% (low) → 100% (high)
Effort: person-months

Example:
Feature "Password Reset"
- Reach: 1000 (10% users need it quarterly)
- Impact: 2 (high - major pain relief)
- Confidence: 90%
- Effort: 0.5 (2 weeks)

RICE = (1000 × 2 × 0.9) / 0.5 = 3600
```

### User Story Format

```
As a [user type]
I want [action/feature]
So that [benefit]

Acceptance Criteria:
Given [context]
When [action]
Then [outcome]

Example:
As a registered user
I want to reset my password via email
So that I can regain access if I forget it

Given I'm on login page
When I click "Forgot password" and enter email
Then I receive reset link within 5 minutes
```

### AARRR Metrics

```
Acquisition: как users находят продукт
- Traffic sources, Sign-up rate, CAC

Activation: первый positive experience
- Onboarding completion, Time to value

Retention: users возвращаются
- DAU/WAU/MAU, Retention curves, Churn

Revenue: монетизация
- ARPU, LTV, Conversion to paid

Referral: users приводят других
- Viral coefficient, NPS, Referral rate
```

### Jobs-to-be-Done

```
Format:
"When [situation],
I want to [motivation],
So I can [outcome]"

Example:
"When I'm reviewing code,
I want to quickly spot potential bugs,
So I can maintain quality without slowing down the team"
```

## Структура Notion (рекомендуется)

### Databases

**Roadmap Database:**
```
- Title (text)
- Quarter (select)
- Theme (select)
- Status (select: Planning, In Progress, Done)
- Success Metrics (text)
- Owner (person)
```

**Backlog Database:**
```
- Title (text)
- Type (select: Epic, Story, Bug, Task)
- Status (select: Backlog, Ready, In Progress, Done)
- Priority (select: P0, P1, P2, P3)
- RICE Score (number)
- Epic (relation)
- Assignee (person)
- Sprint (relation)
- Estimate (number)
```

**Metrics Database:**
```
- Metric Name (text)
- Value (number)
- Date (date)
- Target (number)
- Status (formula)
```

### Templates

Плагин создаёт и использует Notion templates для:
- Epic template
- User Story template
- Initiative template
- Metrics Report template
- Release Notes template

## Workflow Examples

### Пример 1: Quarterly Planning

```
1. "Создай roadmap на Q2 2025"
   → roadmap-planner agent активируется
   → Анализирует OKR и strategic goals
   → Группирует features по themes
   → Создаёт initiatives в Notion
   → Links к epics

2. "Приоритизируй backlog"
   → backlog-manager agent активируется
   → prioritization skill применяется
   → RICE scoring для всех items
   → Распределяет по P0/P1/P2/P3

3. "Распредели top priorities по quarters"
   → Планирует timeline
   → Checks dependencies
   → Balances capacity
```

### Пример 2: Feature Development

```
1. "Исследуй проблему: users struggle with onboarding"
   → product-discovery skill активируется
   → Предлагает interview questions
   → Validation framework
   → Documents findings

2. /create-epic "Onboarding Redesign"
   → Создаёт structured epic
   → Problem statement
   → Success metrics
   → RICE score
   → Links к roadmap

3. "Разбей epic на stories"
   → Decomposition на user stories
   → Given-When-Then acceptance criteria
   → Estimates
   → Definition of Ready

4. Sprint execution...

5. /release-notes
   → Генерирует release notes
   → User-friendly language
   → Highlights key improvements
```

### Пример 3: Data-Driven Decision

```
1. "Проанализируй retention метрики"
   → metrics-analyst agent активируется
   → Fetches data
   → Cohort analysis
   → Identifies trends
   → Insights + recommendations

2. "Какие features улучшат retention?"
   → Discovery на основе data
   → Hypothesis generation
   → Impact estimation

3. "Приоритизируй candidates с фокусом на retention"
   → backlog-manager + prioritization skill
   → RICE scoring candidates
   → Retention impact в Impact score
   → Ranking

4. "Создай A/B test plan для top feature"
   → Test design
   → Metrics definition
   → Sample size calculation
```

## Tips & Best Practices

### Roadmap Planning

✅ **Do:**
- Focus на outcomes, не outputs
- Quarterly planning (более далее - high-level)
- Link initiatives к OKR
- Leave buffer (20-30% capacity)
- Regular review и adjust

❌ **Don't:**
- Detailed plan на год вперёд
- Commit без validation
- Игнорировать tech debt
- Переоценивать capacity

### Backlog Management

✅ **Do:**
- Weekly grooming sessions
- Keep backlog size reasonable (2-4 sprints)
- Definition of Ready для всех top items
- Balance: 60% features, 20% bugs, 10% tech debt, 10% innovation
- Archive old items (>6 months)

❌ **Don't:**
- Hundreds of unrefined items
- No priorities
- Stale items cluttering backlog
- 100% features (tech debt растёт)

### Prioritization

✅ **Do:**
- Use frameworks (RICE рекомендуется)
- Document reasoning
- Involve team в estimation
- Review regularly
- Communicate trade-offs

❌ **Don't:**
- HIPPO (Highest Paid Person's Opinion)
- Gut feel без data
- Everything is P0
- Игнорировать opportunity cost
- Forget dependencies

### Metrics

✅ **Do:**
- Define North Star metric
- Track leading indicators (predictive)
- Segment analysis (cohorts)
- Set targets
- Review trends, not just absolutes

❌ **Don't:**
- Too many metrics (focus на key)
- Vanity metrics (не actionable)
- Игнорировать qualitative feedback
- Analysis без action
- Correlation = causation

## Integration с .NET Workflow

Этот плагин designed для .NET команд:

- **GitLab Integration**: используйте с `gitlab` MCP для linking issues → epics
- **Supabase**: metrics tracking в PostgreSQL через `supabase` MCP
- **Notion**: primary tool для roadmap, backlog, documentation
- **Development Tools**: координация с `/dotnet-build`, `/dotnet-test` commands

Пример integrated workflow:
```
1. Discovery → Epic creation (Notion)
2. Epic → Stories decomposition
3. Stories → GitLab issues
4. Development → /dotnet-build, /dotnet-test
5. Deployment → metrics tracking (Supabase)
6. Analysis → metrics-analyst agent
7. Iteration → prioritize based на data
```

## Troubleshooting

**Notion MCP не работает:**
```bash
# Проверьте API key
echo $NOTION_TOKEN

# Убедитесь что pages shared с integration
# В Notion: Settings & Members → Connections → Add connection
```

**RICE scores кажутся weird:**
```
- Проверьте units (Reach per quarter, не per month)
- Impact scale: 0.25/0.5/1/2/3 (не 1-10)
- Confidence: percentage (0.5/0.8/1.0)
- Effort: person-months (не days или hours)
```

**Stories слишком большие:**
```
Use story splitting techniques:
- By workflow steps
- By CRUD operations
- Happy path vs edge cases
- Simple vs complex version
- Per platform/device
```

## Roadmap Plugin'а

- [ ] Templates для common discovery artifacts
- [ ] Automated metrics dashboards generation
- [ ] GitLab issues ↔ Notion stories sync
- [ ] Slack notifications для priority changes
- [ ] AI-powered insights from metrics trends
- [ ] Customer feedback aggregation (support tickets, NPS)
- [ ] Competitor tracking integration

## Contributing

Suggestions welcome! Areas для improvement:

- Additional prioritization frameworks
- More metrics templates
- Industry-specific playbooks (SaaS, Enterprise, Mobile)
- Integration с другими PM tools (Jira, Linear, etc.)

## License

См. корневой LICENSE файл проекта.

## PM vs SA: Role Separation

### Product Manager (THIS plugin)
**Focus:** Strategic level, business value, high-level planning

**Responsibilities:**
- 📋 Epics creation and management
- 🗺️ Roadmap planning (quarterly/yearly)
- 💡 Business requirements formulation
- 📊 Metrics, KPIs, OKRs
- 🎯 Strategic prioritization (RICE)

**NOT responsible for:**
- ❌ User story writing (→ System Analyst)
- ❌ Acceptance criteria (→ System Analyst)
- ❌ Technical specifications (→ System Analyst)

### System Analyst (separate plugin: dex-system-analyst)
**Focus:** Tactical level, technical details, implementation specs

**Responsibilities:**
- 📝 User stories from epics (INVEST, AC)
- ✅ Acceptance criteria (Given-When-Then)
- 🔄 BPMN процессы
- 🔌 API specifications (OpenAPI)

### Collaboration Flow
```
1. PM создает Epic (business value, metrics, high-level scope)
   ↓
2. PM + SA: refinement session (alignment discussion)
   ↓
3. SA декомпозирует Epic → User Stories (detailed)
   ↓
4. PM reviews stories for business value alignment
   ↓
5. PM + SA: prioritize stories within epic
   ↓
6. Dev Team estimates and implements
```

---

**Version:** 4.5.0
**Author:** DEX Team
**Requires:** Notion MCP server
**Tags:** product-management, roadmap, epic-planning, business-requirements, metrics, strategy
