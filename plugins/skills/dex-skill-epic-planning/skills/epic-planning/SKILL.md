---
name: epic-planning
description: Активируется при создании или планировании epics, roadmap items, initiatives. Фокус на business value, high-level scope, success metrics. NOT for user stories - that's SA domain.
allowed-tools: Read, Write, Edit
---

# Epic Planning Skill

Этот skill помогает Product Manager'у создавать и планировать epics - крупные features или инициативы, которые не помещаются в один sprint и требуют стратегического планирования.

## Когда активируется

Используйте этот skill когда:
- Создаёте новый epic
- Планируете roadmap (quarters, initiatives)
- Определяете business value для features
- Устанавливаете success metrics
- Структурируете high-level scope
- Оцениваете effort на epic level

**НЕ используйте** для:
- Написания user stories (это работа System Analyst)
- Детальных acceptance criteria (это SA)
- Технических спецификаций (это SA)

## Epic Definition

**Epic** - большая feature или инициатива, которая:
- Не помещается в один sprint (2-12 weeks work)
- Имеет четкую business value
- Может быть разбита на user stories
- Aligned с product strategy

## Epic Structure Template

```markdown
# Epic: [Descriptive Name - 3-5 words]

## Problem Statement

### Current State
Что происходит сейчас? В чём боль пользователей или бизнеса?

### Desired State
Как должно быть после реализации epic?

### Impact
Кого это затрагивает? Сколько пользователей? Какие business процессы?

## Business Value

### Why This Matters
- Alignment со strategic goals
- Impact на key business metrics (revenue, retention, acquisition)
- Competitive advantage или market necessity
- Risk mitigation

### Value Proposition
Для [target users]
Которые [имеют проблему]
Наш [epic]
Позволяет [решение]
В отличие от [alternatives]
Мы [unique differentiator]

## Success Metrics

### Primary Metric
Главная метрика успеха:
- Metric: [название метрики]
- Current: [текущее значение]
- Target: [целевое значение]
- Timeline: [когда достигнуть]

### Secondary Metrics
Supporting metrics:
- [Metric 1]: baseline → target
- [Metric 2]: baseline → target

### Anti-Metrics (Watch Out For)
Что может ухудшиться и не должно:
- [Metric A]: should not drop below [threshold]
- [Metric B]: must maintain at least [level]

## High-Level Scope

### In Scope
Что включает этот epic (general features, не detailed stories):
- [ ] Major feature area 1
- [ ] Major feature area 2
- [ ] Major feature area 3

### Out of Scope
Что явно НЕ включено (manage expectations):
- [ ] Feature X (reason: will be in future epic)
- [ ] Feature Y (reason: out of current strategy)
- [ ] Feature Z (reason: too complex, needs research)

### User Personas Affected
- **Primary**: [Main persona] - [their main need]
- **Secondary**: [Supporting persona] - [their need]

## High-Level User Stories

Крупные stories (epic level, не детальные):

1. As a [primary persona], I want [major capability] so that [key benefit]
2. As a [user type], I want [feature area] so that [business value]
3. As a [stakeholder], I want [outcome] so that [strategic goal]

**Note**: Детальная разбивка на user stories - задача System Analyst'а.

## Dependencies & Prerequisites

### Depends On
Что должно быть готово перед началом:
- [ ] Epic/Initiative: [name] - [reason]
- [ ] Technical: [infrastructure, platform, service]
- [ ] Business: [contract, approval, resource]

### Blocks/Enables
Что этот epic разблокирует:
- [ ] Future Epic: [name] - [how]
- [ ] Business Capability: [what becomes possible]

### Integration Points
С какими системами/командами интеграция:
- External System: [name] - [integration type]
- Team: [which team] - [collaboration needed]

## Risks & Mitigation

### Technical Risks
- **Risk**: [description]
  - Probability: High/Medium/Low
  - Impact: High/Medium/Low
  - Mitigation: [plan]

### Business Risks
- **Risk**: [market, competition, adoption]
  - Probability: [H/M/L]
  - Impact: [H/M/L]
  - Mitigation: [strategy]

### Resource Risks
- **Risk**: [team capacity, skill gaps, dependencies]
  - Probability: [H/M/L]
  - Impact: [H/M/L]
  - Mitigation: [approach]

## Effort Estimation

### T-Shirt Size
- [ ] S (2-4 weeks)
- [ ] M (1-2 months)
- [ ] L (2-3 months)
- [ ] XL (3+ months - consider splitting)

### Team Capacity
- Estimated Story Points: [range, e.g., 40-60]
- Team Velocity: [average per sprint]
- Estimated Sprints: [number]

### Confidence Level
- [ ] High (80-100%): well understood, low risk
- [ ] Medium (50-80%): some unknowns, moderate risk
- [ ] Low (<50%): many unknowns, needs spike/research

## Timeline & Roadmap

### Target Dates
- **Start**: [Quarter / Month]
- **End**: [Quarter / Month]
- **Milestones**:
  - [Date]: [Milestone 1 - key deliverable]
  - [Date]: [Milestone 2 - key deliverable]

### Roadmap Placement
- **Quarter**: Q[X] 20XX
- **Theme**: [Strategic theme for quarter]
- **Priority**: P0 (Must Have) / P1 (Should Have) / P2 (Nice to Have)

## Definition of Done (Epic Level)

Epic считается done когда:
- [ ] All major user stories completed and accepted
- [ ] Success metrics achieved (or clear path to achieve)
- [ ] All acceptance criteria met
- [ ] Tested in production environment
- [ ] Documentation completed (user guides, API docs)
- [ ] Training/onboarding materials ready (if needed)
- [ ] Stakeholder demo completed and approved
- [ ] Monitoring and analytics in place
- [ ] Post-launch review scheduled

## Stakeholders & Communication

### Key Stakeholders
- **Sponsor**: [name/role] - decision maker
- **Product Owner**: [name] - accountable
- **Tech Lead**: [name] - technical feasibility
- **Design Lead**: [name] - UX/UI
- **Business**: [stakeholders who care about outcome]

### Communication Plan
- **Kickoff**: [when, with whom]
- **Updates**: [frequency, format - weekly status, bi-weekly demo]
- **Reviews**: [sprint reviews, stakeholder demos]
- **Launch**: [go-to-market, announcement plan]

## Examples of Good Epic Titles

### Good (Clear, Outcome-Focused)
- "Payment Gateway Integration"
- "Mobile App Redesign"
- "Multi-Language Support"
- "Advanced Reporting Dashboard"
- "Real-Time Notifications System"

### Bad (Too Vague or Too Technical)
- "Improvements" ❌ (what improvements?)
- "Tech Debt" ❌ (too broad, not specific)
- "Refactor Backend" ❌ (technical task, no user value stated)
- "Make it Better" ❌ (not measurable)

## Epic Sizing Guidelines

### Right-Sized Epic
```
✅ 2-12 weeks of work
✅ Single theme/feature area
✅ Clear business value
✅ Measurable outcome
✅ Can be broken into 5-15 user stories
✅ Fits within 1-3 sprints (total)
```

### Too Small (This is a Story, Not Epic)
```
❌ <2 weeks of work
❌ Single user story
❌ Fits in one sprint
→ Make this a Story, not Epic
```

### Too Large (Break Down)
```
❌ >1 quarter (3 months)
❌ Multiple unrelated features
❌ Vague scope
→ Split into multiple epics or create Initiative
```

## Epic Decomposition Process

Когда epic готов к реализации:

### Step 1: Validate Epic
- Business value clear? ✓
- Success metrics defined? ✓
- Dependencies resolved? ✓
- Stakeholders aligned? ✓

### Step 2: Story Mapping Session
С участием PM + SA + Tech Lead:
- Выделить user journey steps
- Identify major capabilities needed
- Group by value streams
- Prioritize must-have vs nice-to-have

### Step 3: Hand Off to System Analyst
PM передает SA:
- Epic document
- Business requirements
- Success metrics
- Constraints and priorities

SA создает:
- Detailed user stories
- Acceptance criteria (Given-When-Then)
- Technical specifications
- API contracts

### Step 4: Backlog Refinement
Вместе PM + SA + Dev Team:
- Review stories
- Clarify acceptance criteria
- Estimate story points
- Identify technical risks
- Finalize Definition of Ready

## Best Practices

### 1. Outcome Over Output
```
❌ Bad: "Build 5 new features"
✅ Good: "Increase user activation by 20%"

Focus on business outcome, not feature count
```

### 2. Measurable Success
```
❌ Bad: "Improve user experience"
✅ Good: "Reduce onboarding time from 10min to 3min, increase Day 7 retention by 15%"

Always quantify success
```

### 3. Clear Boundaries
```
✅ Explicit In Scope / Out of Scope
✅ Manage stakeholder expectations
✅ Avoid scope creep

Document what's NOT included
```

### 4. Business Language
```
✅ Write for stakeholders, not developers
✅ Focus on "why" before "what"
✅ Technical details in "Technical Notes" section

Keep epic description business-focused
```

### 5. Progressive Elaboration
```
Early (3 months out):
- High-level epic
- General scope
- Rough estimate

Close (1 month out):
- Detailed requirements
- SA creates stories
- Team estimates

Keep distant work high-level, elaborate as it approaches
```

## Common Epic Patterns

### New Feature Epic
```markdown
Epic: Customer Reviews & Ratings

Problem: Users can't share experiences or make informed decisions
Value: Increase conversion by 12%, build trust
Scope: Review submission, rating display, moderation
Metrics: 30% of purchases with reviews, 4+ avg rating
```

### Redesign Epic
```markdown
Epic: Dashboard Redesign

Problem: Current dashboard is cluttered, low engagement (15% DAU use it)
Value: Increase dashboard usage to 45% DAU, improve satisfaction
Scope: New layout, customizable widgets, mobile responsive
Metrics: DAU/Dashboard usage, time on dashboard, NPS
```

### Integration Epic
```markdown
Epic: CRM Integration (Salesforce)

Problem: Manual data sync between systems, errors, delays
Value: Save 10 hours/week, reduce errors by 80%
Scope: Bi-directional sync, real-time updates, conflict resolution
Metrics: Sync success rate >99%, data latency <5min
```

### Performance Epic
```markdown
Epic: Platform Performance Optimization

Problem: Slow page loads (avg 8sec), high bounce rate (45%)
Value: Reduce bounce rate to <20%, improve user satisfaction
Scope: Frontend optimization, API caching, database tuning
Metrics: Page load <2sec (p95), API response <500ms
```

## Roadmap Integration

Epic в roadmap:

```
Q1 2025: Foundation & Stability
├── Epic: Platform Performance (P0)
├── Epic: Security Audit & Fixes (P0)
└── Epic: Mobile Responsive Design (P1)

Q2 2025: Growth & Engagement
├── Epic: Social Login Integration (P0)
├── Epic: Advanced Search (P1)
└── Epic: User Notifications System (P2)
```

Каждый epic:
- Привязан к quarter
- Имеет priority
- Aligned с quarterly theme
- Contributes к OKRs

## Templates Summary

### Minimal Epic (for quick creation)
```markdown
# Epic: [Name]

**Problem**: [What problem are we solving?]
**Value**: [Why is this important? Business impact?]
**Scope**: [What's included? What's not?]
**Success**: [How do we measure success?]
**Timeline**: [Target quarter/dates]
**Owner**: [PM name]
```

### Full Epic (for major initiatives)
Use complete template above with all sections.

## Collaboration with System Analyst

### PM Responsibilities (Epic Level)
- ✅ Business value definition
- ✅ Success metrics
- ✅ High-level scope
- ✅ Prioritization
- ✅ Stakeholder alignment

### SA Responsibilities (Story Level)
- ✅ User story writing from epic
- ✅ Detailed acceptance criteria
- ✅ Technical specifications
- ✅ API contracts
- ✅ Process flows (BPMN)

### Handoff Process
1. PM creates epic with business requirements
2. PM + SA discuss scope and clarify questions
3. SA decomposes epic into user stories
4. PM reviews stories for alignment with value
5. Together refine and prioritize stories

## Remember

- Epic = Strategic Feature (PM domain)
- Story = Tactical Implementation (SA domain)
- Keep epic focused on business value and outcomes
- Leave technical details to SA and dev team
- Use agile-fundamentals skill for general Agile concepts

Great epics enable great products! Focus on the "why" and "what," let the team figure out the "how."
