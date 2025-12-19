---
name: prioritization
description: Strategic prioritization frameworks (RICE, ICE, MoSCoW, Kano). Активируется при "приоритизация", "prioritize", "RICE score", "приоритеты", "что делать первым", "backlog prioritization", "feature ranking"
allowed-tools: Read, Write, Edit
---

# Prioritization Frameworks Skill

Systematic frameworks для приоритизации features, epics, и backlog items на strategic level.

## Когда активируется

- Приоритизация backlog или roadmap
- Ранжирование features или epics
- Решение "что делать первым"
- Сравнение альтернатив
- RICE/ICE scoring
- MoSCoW categorization

## Core Frameworks

### 1. RICE Scoring (Recommended)

**Formula:**
```
RICE Score = (Reach × Impact × Confidence) / Effort
```

**Components:**

**Reach** (число пользователей за период)
- Сколько пользователей/events за quarter
- Примеры: 1000 users, 500 transactions/month
- Используйте реальные числа, НЕ проценты

**Impact** (влияние на пользователя)
- **3** = Massive impact (core value prop change)
- **2** = High impact (major improvement)
- **1** = Medium impact (noticeable improvement)
- **0.5** = Low impact (minor improvement)
- **0.25** = Minimal impact (tiny improvement)

**Confidence** (уверенность в оценках)
- **100%** (1.0) = High confidence (data-driven, validated)
- **80%** (0.8) = Medium confidence (some data, reasonable assumptions)
- **50%** (0.5) = Low confidence (mostly assumptions, needs validation)

**Effort** (затраты команды)
- Измеряется в **person-months**
- Примеры:
  - 0.5 = 2 weeks (one person)
  - 1.0 = 1 month
  - 2.0 = 2 months или 1 month (2 people)
  - 6.0 = 6 months или 3 months (2 people)

**Example:**
```
Feature: Password Reset via Email

Reach: 1000 users/quarter (10% of user base needs it)
Impact: 2 (high - major pain point relief)
Confidence: 90% (we have support ticket data)
Effort: 0.5 person-months (2 weeks)

RICE = (1000 × 2 × 0.9) / 0.5 = 3600
```

**Interpretation:**
- **>1000**: Very high priority
- **500-1000**: High priority
- **100-500**: Medium priority
- **<100**: Low priority

### 2. ICE Scoring (Quick Alternative)

Когда нет точных данных для RICE, используйте ICE:

**Formula:**
```
ICE Score = (Impact + Confidence + Ease) / 3
```

**Components:**
- **Impact**: 1-10 scale (business value)
- **Confidence**: 1-10 scale (how sure you are)
- **Ease**: 1-10 scale (10 = very easy, 1 = very hard)

**Example:**
```
Feature: Dark Mode

Impact: 6 (users ask for it, but not critical)
Confidence: 7 (clear from surveys)
Ease: 8 (straightforward CSS changes)

ICE = (6 + 7 + 8) / 3 = 7.0
```

### 3. MoSCoW Method

Categorical prioritization:

**Must Have (P0)**
- Critical для launch/release
- Without this, product doesn't work
- Legal/compliance requirements
- Core value proposition

**Should Have (P1)**
- Important but not critical
- Workarounds exist
- High value, добавляем если capacity есть

**Could Have (P2)**
- Nice to have
- Low priority improvements
- Include if time permits

**Won't Have (P3)**
- Explicitly out of scope for now
- Maybe in future releases
- Not aligned с current goals

### 4. Value vs Effort Matrix

2x2 matrix для quick visual prioritization:

```
High Value, Low Effort  →  Quick Wins (Do First!)
High Value, High Effort →  Major Projects (Plan carefully)
Low Value, Low Effort   →  Fill-ins (If time permits)
Low Value, High Effort  →  Avoid (Don't do)
```

### 5. Kano Model

Categorize features по user satisfaction:

**Basic Needs (Table Stakes)**
- Expected by users
- Absence causes dissatisfaction
- Presence is neutral

**Performance Needs (Linear)**
- More is better
- Satisfaction increases linearly

**Delighters (Unexpected)**
- Not expected
- Presence creates delight
- High impact on satisfaction

**Indifferent**
- Users don't care
- Low priority

## Prioritization Process

### Step 1: List All Candidates

Соберите все items для приоритизации:
- Features from roadmap
- Epics from backlog
- Bug fixes
- Technical debt
- Improvements

### Step 2: Choose Framework

- **RICE**: Когда есть data и нужна объективность
- **ICE**: Когда быстрая оценка нужна
- **MoSCoW**: Для scope definition (MVP)
- **Value/Effort**: Для visual brainstorming
- **Kano**: Для understanding user impact

### Step 3: Score Each Item

Применить выбранный framework:

```markdown
| Item | Reach | Impact | Confidence | Effort | RICE Score |
|------|-------|--------|------------|--------|------------|
| Feature A | 2000 | 2 | 0.8 | 1.0 | 3200 |
| Feature B | 500 | 3 | 0.9 | 0.5 | 2700 |
| Feature C | 1000 | 1 | 1.0 | 2.0 | 500 |
```

### Step 4: Sort & Assign Priorities

Sort по score (descending):
1. Feature A (RICE: 3200) → P0
2. Feature B (RICE: 2700) → P0
3. Feature C (RICE: 500) → P1

### Step 5: Apply Constraints

Adjust на основе:
- **Dependencies**: Feature B blocks Feature D
- **Strategic alignment**: Roadmap theme
- **Team capacity**: Realism check
- **Risk**: High-risk items need validation first

### Step 6: Validate with Stakeholders

- Present scoring с reasoning
- Discuss trade-offs
- Get buy-in from team and stakeholders
- Document decisions

## Best Practices

### 1. Use Consistent Timeframe

- Reach always per **quarter** (not month or year)
- Effort in **person-months**
- Re-score quarterly

### 2. Involve Team

- Engineering для effort estimation
- Product для impact assessment
- Data/Analytics для reach validation
- Stakeholders для confidence check

### 3. Document Assumptions

```markdown
## Assumptions for Feature X RICE Score

Reach: 1000/quarter
- Based on: Google Analytics (10% users hit this flow)
- Assumption: Retention stays constant

Impact: 2 (High)
- Based on: NPS surveys mention this pain point
- Assumption: Fixing will improve satisfaction

Confidence: 80%
- We have data for reach
- Impact is survey-based (not A/B tested)

Effort: 1.5 person-months
- Based on: Tech lead estimate
- Includes: Design, dev, QA, docs
- Assumption: No major blockers
```

### 4. Re-evaluate Regularly

- Quarterly review всех scores
- Update на основе new data
- Archive completed items
- Add new candidates

### 5. Balance Portfolio

Не только high RICE scores:
- **70%** - High value features
- **20%** - Tech debt / infrastructure
- **10%** - Experiments / innovation

### 6. Transparency

- Share scoring methodology с командой
- Explain why priorities change
- Document trade-offs made
- Make backlog visible

## Common Pitfalls

### ❌ Everything is P0

Problem: No prioritization if everything is critical

Solution: Force rank, use quotas (max 10-15% can be P0)

### ❌ HIPPO Prioritization

HIPPO = Highest Paid Person's Opinion

Problem: Gut feel overrides data

Solution: Use frameworks, show scores, require justification

### ❌ Ignoring Effort

Problem: Only looking at value

Solution: Always consider effort (RICE, Value/Effort matrix)

### ❌ Stale Priorities

Problem: Set once, never updated

Solution: Quarterly review, adjust based on learnings

### ❌ Fake Precision

Problem: RICE score 3247.8 vs 3251.3

Solution: Scores are estimates, not exact. Group by tiers.

### ❌ Analysis Paralysis

Problem: Spending weeks on scoring

Solution: ICE for quick decisions, RICE for strategic bets

## Examples

### Example 1: Feature Comparison

```markdown
## Feature Prioritization: Q2 2025

| Feature | Reach | Impact | Conf | Effort | RICE | Priority |
|---------|-------|--------|------|--------|------|----------|
| Password Reset | 1000 | 2 | 0.9 | 0.5 | 3600 | P0 |
| Dark Mode | 3000 | 1 | 0.8 | 0.5 | 4800 | P0 |
| Export to PDF | 500 | 2 | 1.0 | 1.0 | 1000 | P1 |
| Custom Themes | 800 | 0.5 | 0.5 | 2.0 | 100 | P2 |
| Social Sharing | 2000 | 1 | 0.5 | 1.5 | 667 | P1 |

Decision:
- P0: Dark Mode, Password Reset (high RICE, low effort)
- P1: Export PDF, Social Sharing (medium RICE)
- P2: Custom Themes (low RICE, high effort)
```

### Example 2: Backlog Grooming

```markdown
## Epic Prioritization (MoSCoW)

Must Have (P0):
- User Authentication (legal requirement, blocks other features)
- Payment Processing (core value prop)
- Security Audit Fixes (compliance)

Should Have (P1):
- Email Notifications (users expect it)
- Search Functionality (high value)
- Mobile Responsive (important but desktop works)

Could Have (P2):
- Advanced Filters (nice improvement)
- Keyboard Shortcuts (power users like it)
- Custom Branding (low reach)

Won't Have (P3):
- Multi-language (future, needs research)
- API v2 (v1 sufficient for now)
- Admin Dashboard redesign (working, low ROI)
```

### Example 3: Trade-off Decision

```markdown
## Decision: Feature A vs Feature B

Feature A: Improved Onboarding
- RICE: 2400 (Reach: 3000, Impact: 2, Conf: 0.8, Effort: 2.0)
- Pros: Addresses #1 user complaint, likely improves activation
- Cons: 2 month effort, needs design work
- Risk: Impact assumption not validated

Feature B: Performance Optimization
- RICE: 1500 (Reach: 5000, Impact: 1, Conf: 0.9, Effort: 3.0)
- Pros: Affects all users, clear metrics
- Cons: 3 month effort, technical complexity
- Risk: High effort, may not deliver expected gains

Decision: Feature A (P0), Feature B (P1)
Rationale: Higher RICE, lower effort, addresses user pain point.
Feature B scheduled for Q3 after measuring Feature A impact.
```

## Integration with Notion

When working with Notion backlog:

1. **Add RICE columns** to database:
   - Reach (number)
   - Impact (select: 0.25/0.5/1/2/3)
   - Confidence (select: 50%/80%/100%)
   - Effort (number - person-months)
   - RICE Score (formula)

2. **Formula for RICE column:**
   ```
   (prop("Reach") * prop("Impact") * prop("Confidence")) / prop("Effort")
   ```

3. **Views:**
   - Sorted by RICE Score (descending)
   - Filtered by Status = Backlog
   - Grouped by Priority (P0/P1/P2/P3)

## Remember

- **Frameworks are tools, not rules** - Use judgment
- **Involve the team** - Shared understanding > perfect score
- **Iterate** - Priorities change as you learn
- **Communicate** - Transparency builds trust
- **Balance** - High value + quick wins + strategic bets

Prioritization is as much art as science. The goal is better decisions, not perfect scores.
