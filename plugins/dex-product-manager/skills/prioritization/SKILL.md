---
name: prioritization
description: Активируется при необходимости приоритизации features, принятия trade-off решений
allowed-tools: Read, Write, Edit, Grep, Glob
---

# Prioritization Skill

Этот skill помогает Product Manager'у систематически приоритизировать features, bugs, tech debt и принимать informed trade-off решения.

## Когда активируется

Используйте этот skill когда:
- Нужно выбрать что build first
- Backlog требует prioritization
- Ограниченные resources (всегда!)
- Conflicting requests от stakeholders
- Planning roadmap
- Sprint planning
- Resolving disputes о priorities

## Core Principles

### 1. You Can't Do Everything

```
Saying YES to one thing = Saying NO to другим вещам.

Resource constraints:
- Time (sprints конечны)
- People (team размер фиксирован)
- Attention (focus matters)

Prioritization = choosing where to allocate scarce resources.
```

### 2. Opportunity Cost

```
Building Feature A означает NOT building B, C, D.

Always ask:
"What are we NOT doing by choosing this?"

Better question:
"What's the BEST use of our next sprint?"
```

### 3. Maximize Impact per Effort

```
Impact ÷ Effort = ROI

Low-hanging fruit: high impact, low effort (do first!)
Big bets: high impact, high effort (plan carefully)
Time sinks: low impact, high effort (avoid!)
Fill-ins: low impact, low effort (do если spare capacity)
```

### 4. Data Over Opinions

```
❌ "I think users want X"
❌ "The CEO wants Y"
❌ "Competitor has Z"

✅ "Users requested X 47 times"
✅ "Missing Y costs us $10K/month"
✅ "Z would increase retention by 15%"

Use frameworks to structure decision-making.
```

## Prioritization Frameworks

### 1. RICE Scoring (Recommended)

**Best for:** feature prioritization, objective comparison

```
RICE = (Reach × Impact × Confidence) / Effort

Example:
Feature: "Password Reset via Email"

Reach: 1000 users per quarter (estimate: 10% of users need it)
Impact: 2 (High - significant pain point relief)
Confidence: 90% (high - common feature, understood)
Effort: 0.5 (person-months - 2 weeks work)

RICE = (1000 × 2 × 0.9) / 0.5 = 3600

Higher score = Higher priority
```

**How to Score:**

**Reach (number):**
```
Сколько users/customers затронет per time period?

Period: quarter (3 months)
Count: unique users who'll interact

Examples:
- All active users: 10,000
- Power users only: 500
- New users onboarding: 1,000/quarter
```

**Impact (multiplier):**
```
Насколько сильно повлияет на каждого user?

Scale:
3 = Massive Impact
  - Game-changer
  - Core value prop
  - 10x improvement
  - Example: "Real-time collaboration"

2 = High Impact
  - Significant improvement
  - Solves major pain point
  - Clear measurable benefit
  - Example: "50% faster search"

1 = Medium Impact
  - Noticeable improvement
  - Removes friction
  - Nice to have
  - Example: "Keyboard shortcuts"

0.5 = Low Impact
  - Small improvement
  - Edge case
  - Cosmetic
  - Example: "Button color change"

0.25 = Minimal Impact
  - Barely noticeable
  - Example: "Label text tweak"
```

**Confidence (percentage):**
```
Насколько уверены в Reach/Impact estimates?

100% = High Confidence
  - Have data (analytics, research)
  - Common feature, well understood
  - Example: "Login with Google"

80% = Medium Confidence
  - Some data, some assumptions
  - Similar features exist elsewhere
  - Example: "Dark mode"

50% = Low Confidence
  - Mostly assumptions
  - Unproven concept
  - Need more research
  - Example: "AI-powered feature"

If confidence <50%, do more discovery first!
```

**Effort (person-months):**
```
Сколько work потребуется from whole team?

Include:
- Design
- Development
- Testing
- Documentation
- Deployment

Examples:
0.1 = Few hours (config change)
0.25 = Few days (small feature)
0.5 = 1-2 weeks (medium feature)
1 = 2-4 weeks (large feature)
2 = 1-2 months (epic)
6 = Quarter (major initiative)
12 = 6+ months (avoid! break down)

Get estimate from eng team!
```

**Interpreting RICE:**
```
>20: Extremely high priority (rare)
10-20: High priority (top tier)
5-10: Medium priority (solid features)
2-5: Lower priority (backlog)
<2: Very low priority (reconsider)

Not absolute! Compare within your backlog.
Sort all items by RICE, top = build first.
```

### 2. MoSCoW Method

**Best for:** release planning, MVP definition

```
Must Have: non-negotiable, release fails without it
Should Have: important, but release can happen without
Could Have: nice-to-have, include if time permits
Won't Have (this time): out of scope, maybe later

Distribution guideline:
Must: 60% of capacity
Should: 20%
Could: 20%
Won't: everything else
```

**How to Categorize:**

```
Must Have:
- Legal/compliance requirements
- Core functionality without which product doesn't work
- Critical bugs (P0)
- Committed features (contractual)

Ask: "Can we ship without this?"
If NO → Must Have

Should Have:
- Important features
- Significant improvements
- High-impact bugs (P1)

Ask: "Would users complain if missing?"
If YES → Should Have

Could Have:
- Nice improvements
- Polish
- Medium-impact bugs (P2)

Ask: "Would this be a pleasant surprise?"
If YES → Could Have

Won't Have:
- Future ideas
- Out of scope
- Low-impact items (P3)
- "Maybe someday"

Ask: "Does this belong in this release?"
If NO → Won't Have
```

**Process:**
```
1. List all candidates для release
2. Collaborative session с team
3. For each item, discuss и categorize
4. If too many "Must", challenge assumptions
5. Be ruthless - когда сомневаетесь, downgrade
6. Document reasoning
```

### 3. ICE Score

**Best for:** quick prioritization, small teams, limited data

```
ICE = (Impact + Confidence + Ease) / 3

Each dimension: 1-10 scale

Faster than RICE, less precise.
Good для быстрого scoring или brainstorming sessions.
```

**Scoring:**

**Impact (1-10):**
```
1-3: Minimal impact
4-6: Moderate impact
7-8: High impact
9-10: Game-changing

Ask: "How much will this move the needle?"
```

**Confidence (1-10):**
```
1-3: Low confidence (много assumptions)
4-6: Medium confidence (some data)
7-8: High confidence (good data)
9-10: Very high confidence (validated)

Ask: "How sure are we about the impact?"
```

**Ease (1-10):**
```
1-3: Very hard (months of work)
4-6: Medium effort (weeks)
7-8: Easy (days)
9-10: Very easy (hours)

Ask: "How quickly can we ship this?"
```

**Usage:**
```
Good for:
- Startup environments (fast decisions)
- Brainstorming sessions
- Quick gut-checks

Not good for:
- Detailed planning
- Large backlogs
- Precise comparisons
```

### 4. Value vs Effort Matrix (2x2)

**Best for:** visualizing trade-offs, stakeholder communication

```
        High Value
            |
    II      |      I
  Plan      |    Do First
  Carefully |   (Quick Wins)
------------+------------
    III     |     IV
  Do Later  |   Avoid
  (Fill-in) | (Money Pit)
            |
        Low Value

            Easy ← → Hard
```

**Quadrants:**

**I - Quick Wins (High Value, Low Effort):**
```
Do FIRST! These are your best opportunities.

Examples:
- Low-hanging fruit
- Clear user requests with simple fix
- High-ROI optimizations

Action: Sprint planning ASAP
```

**II - Big Bets (High Value, High Effort):**
```
Important но requires planning и resources.

Examples:
- Major features
- Platform migrations
- Architectural changes

Action:
- Break into phases
- Validate assumptions
- Plan carefully
- Allocate dedicated time
```

**III - Fill-ins (Low Value, Low Effort):**
```
Do если spare capacity, не priority.

Examples:
- Minor improvements
- Nice-to-have polish
- Easy bugs

Action:
- Backlog
- Junior dev tasks
- Hackathon projects
```

**IV - Money Pits (Low Value, High Effort):**
```
AVOID! Bad ROI.

Examples:
- Over-engineered solutions
- Niche features few want
- "Because competitor has it"

Action:
- Challenge necessity
- Find simpler alternative
- Say NO
```

**Process:**
```
1. Draw 2x2 matrix
2. Place each item (sticky notes работают well)
3. Team discusses placement
4. Visual inspection: много в quadrant I? Good!
5. For quadrant II: can we break down?
6. For quadrant IV: can we cut scope or not do?
```

### 5. Kano Model

**Best for:** understanding customer satisfaction impact

```
Categories:

Must-be (Basic):
- Expected features
- Absence causes dissatisfaction
- Presence doesn't increase satisfaction
- Example: "App doesn't crash"

Performance (Linear):
- More = Better
- Proportional satisfaction
- Competitive differentiator
- Example: "Faster load times"

Attractive (Delighters):
- Unexpected bonuses
- Presence increases satisfaction
- Absence doesn't cause dissatisfaction
- Example: "Easter eggs", "Surprise features"

Indifferent:
- Users don't care either way
- No impact on satisfaction
- Example: Often "nice-to-haves" PMs love but users ignore

Reverse:
- Some users like, some dislike
- Polarizing
- Example: "Autoplay videos"
```

**How to Use:**
```
1. Survey users with question pairs:

"How would you feel if we HAD this feature?"
- Love it
- Expect it
- Neutral
- Can tolerate
- Dislike

"How would you feel if we DID NOT have this feature?"
- Love it
- Expect it
- Neutral
- Can tolerate
- Dislike

2. Plot responses на Kano matrix
3. Prioritize:
   - Must-be first (table stakes)
   - Performance next (competitive advantage)
   - Attractive если есть capacity (delight users)
   - Avoid Indifferent (waste of resources)
```

### 6. Buy a Feature

**Best for:** stakeholder alignment, limited budget scenarios

```
Setup:
1. Give stakeholders "money" (e.g., $100 budget)
2. Assign price to each feature (proportional to effort)
3. Stakeholders "buy" features они хотят
4. Features с most investment = highest priority

Benefits:
- Makes trade-offs explicit
- Forces prioritization
- Builds consensus
- Fun, interactive
```

### 7. Weighted Scoring

**Best for:** multi-criteria decisions, complex evaluations

```
Setup:
1. Define criteria (e.g., User Value, Revenue, Strategic Fit, Effort)
2. Assign weights (sum = 100%)
3. Score each item on each criterion (1-10)
4. Calculate weighted score
5. Sort by score

Example:

Criteria          Weight   Feature A Score   Feature B Score
User Value        40%      8 (3.2)           6 (2.4)
Revenue Impact    30%      5 (1.5)           9 (2.7)
Strategic Fit     20%      7 (1.4)           8 (1.6)
Ease (inverse)    10%      9 (0.9)           4 (0.4)
                           ------            ------
Total                      7.0               7.1

Feature B wins (slightly)!
```

## Advanced Prioritization Concepts

### Cost of Delay

```
Сколько стоит откладывание feature на месяц?

Cost = Value × Time

Example:
Feature adds $10K/month revenue
Each month delayed = $10K opportunity cost
After 3 months delay = $30K lost

High cost of delay → Higher priority

Use CD3 (Cost of Delay Divided by Duration):
CD3 = Cost of Delay / Effort Duration

Prioritize highest CD3 first!
```

### Weighted Shortest Job First (WSJF)

```
WSJF = Cost of Delay / Job Size

Cost of Delay = User Value + Time Criticality + Risk Reduction
Job Size = Effort estimate

Higher WSJF = Do first

SAFe framework используает это.
Good для enterprise environments.
```

### Pareto Principle (80/20 Rule)

```
80% of value comes from 20% of features.

Focus on the 20%!

Questions:
- Which 20% of features deliver 80% of value?
- Which 20% of users generate 80% of revenue?
- Which 20% of bugs cause 80% of frustration?

Prioritize accordingly.
```

### Eisenhower Matrix

```
        Urgent
          |
   III    |    I
  Delegate|   Do Now
----------+---------
   IV     |    II
  Delete  |  Schedule
          |
    Not Urgent
```

**Adapted для product:**

**I - Urgent & Important:**
```
- Critical bugs
- Security issues
- Contractual commitments
- Immediate blockers

Do NOW!
```

**II - Important but Not Urgent:**
```
- Strategic features
- Tech debt
- Platform improvements
- Long-term investments

SCHEDULE - это where value is!
Most items should be here.
```

**III - Urgent but Not Important:**
```
- Interruptions
- Some stakeholder requests
- "Urgent" but low impact

DELEGATE or CHALLENGE
Ask: "Is this really urgent?"
```

**IV - Neither Urgent nor Important:**
```
- Busy work
- Nice-to-haves no one cares about
- Distractions

DELETE from backlog!
```

## Prioritization Process

### Step-by-Step Framework

**1. Gather Inputs**
```
Sources:
- User research / feedback
- Support tickets
- Sales requests
- Engineering concerns (tech debt)
- Business goals (OKR)
- Strategic initiatives (roadmap)
- Competitor analysis
- Analytics data

Create master list всех candidates.
```

**2. Define Evaluation Criteria**
```
Choose 2-4 criteria, например:
- User Impact
- Business Value
- Strategic Alignment
- Technical Effort
- Risk
- Dependencies

Align с company goals!
```

**3. Score Each Item**
```
Use chosen framework (RICE рекомендуется).

Tips:
- Batch scoring (score similar items together)
- Involve team (PM + Eng + Design)
- Use data where available
- Document assumptions
- Be consistent
```

**4. Sort & Tier**
```
Sort by score (highest first).

Group into tiers:
- P0 (Critical): top 10-15%
- P1 (High): next 20-30%
- P2 (Medium): next 30-40%
- P3 (Low): bottom 20-30%

Natural breakpoints обычно visible.
```

**5. Validate & Adjust**
```
Ask:
- Does this make sense?
- Any surprising outliers?
- Strategic alignment?
- Balance: features/bugs/tech debt?
- Dependencies resolved?

Adjust если нужно, document reasoning.
```

**6. Communicate**
```
Share:
- Prioritization results
- Reasoning and framework used
- Trade-offs made
- Next steps

Be transparent about why!
```

**7. Review Regularly**
```
Priorities change!

Review cadence:
- Weekly: top 10 items
- Bi-weekly: top 30 items
- Monthly: full backlog
- Quarterly: strategic review

Update scoring as new information arrives.
```

## Common Prioritization Scenarios

### Scenario 1: Conflicting Stakeholder Requests

```
Problem: CEO wants Feature A, Sales wants B, users need C

Approach:
1. Apply framework (e.g., RICE) to all three
2. Calculate objective scores
3. Present data:
   "Based on reach, impact, and effort:
    Feature C: RICE 25
    Feature B: RICE 18
    Feature A: RICE 8"
4. Discuss trade-offs explicitly
5. Align на shared goals (OKR)
6. Make decision, document reasoning
7. Communicate to all stakeholders

Use data to depersonalize decision.
```

### Scenario 2: Tech Debt vs Features

```
Balance needed!

Rule of thumb:
- 70% features (user-facing value)
- 20% tech debt (keep platform healthy)
- 10% innovation/research (future value)

Prioritizing tech debt:
- Use RICE (treat as feature)
- Impact: reduced bugs, faster dev velocity
- Effort: eng estimate
- Build business case: "This debt slows us 20%"

Never 100% features! Platform будет rot.
```

### Scenario 3: Many P0s

```
If everything is P0, nothing is.

Process:
1. Challenge each P0:
   "What happens if we delay 1 month?"
   "Can we ship without this?"
2. Force-rank even within P0
3. True P0: <10-15% of items
4. Rest: downgrade to P1

Having 50% P0 items = broken prioritization.
```

### Scenario 4: Quick Win vs Big Bet

```
Quick Win: 2 weeks, medium impact
Big Bet: 3 months, high impact (maybe)

Consider:
- Opportunity cost (3 months = 6 quick wins?)
- Risk (Big Bet validated?)
- Team morale (quick wins = momentum)
- Strategic value (Big Bet = competitive moat?)
- Learning (Big Bet = много unknowns?)

Often: do some quick wins first,
then Big Bet когда validated.

Balance: don't only do quick wins (no big moves),
don't only do big bets (risky, slow feedback).
```

## Prioritization Anti-Patterns

**HIPPO (Highest Paid Person's Opinion)**
```
❌ "CEO said so" → build it
✅ "CEO suggested, let's score it against other items"

Use framework для objective evaluation.
```

**Shiny Object Syndrome**
```
❌ "New idea! Drop everything!"
✅ "Interesting. Let's score it and see where it ranks."

New ≠ Important. Apply same framework.
```

**Feature Parity Fallacy**
```
❌ "Competitor has Feature X, we need it too!"
✅ "Does our target user need X? What's the actual impact?"

Don't copy blindly. Prioritize by your users' needs.
```

**Squeaky Wheel**
```
❌ Loudest request gets priority
✅ Frequency + impact of request determines priority

One loud user ≠ priority.
Ten users with same issue = different story.
```

**Analysis Paralysis**
```
❌ Spend weeks perfecting scores
✅ Rough prioritization > perfect prioritization > no prioritization

Good enough быстро > perfect когда-нибудь.
Time-box prioritization sessions!
```

**Sunk Cost Fallacy**
```
❌ "We already invested so much, must finish"
✅ "Given what we know now, is this still the best use of time?"

Past investment irrelevant. Future value matters.
```

## Tips for Effective Prioritization

1. **Use a Framework**: не gut feel, используйте систему
2. **Involve Team**: PM decides, но with team input
3. **Be Transparent**: explain reasoning, share scoring
4. **Regular Review**: priorities drift, update часто
5. **Say No**: protecting yes's means saying no's
6. **Focus**: better to do 3 things great than 10 things poorly
7. **Data-Driven**: metrics > opinions
8. **User-Centric**: user value first, не internal convenience
9. **Balance**: features + bugs + tech debt + innovation
10. **Document**: записывайте reasoning, review later для learning

## Prioritization Checklist

Before finalizing priorities:

- [ ] Framework chosen and applied consistently
- [ ] All items scored using same criteria
- [ ] Engineering estimates included
- [ ] Strategic alignment verified
- [ ] Dependencies identified
- [ ] Balance checked (features/bugs/tech debt)
- [ ] P0 items are truly critical (<15%)
- [ ] Trade-offs explicitly documented
- [ ] Team reviewed and aligned
- [ ] Stakeholders communicated
- [ ] Review date scheduled

## Output Format

После prioritization session:

```markdown
# Prioritization Report - [Date]

## Framework Used
[RICE / MoSCoW / etc.]

## Items Prioritized
Total: [N]
- Features: [N]
- Bugs: [N]
- Tech Debt: [N]

## Priority Distribution
- P0: [N] items ([X]%)
- P1: [N] items ([X]%)
- P2: [N] items ([X]%)
- P3: [N] items ([X]%)

## Top 10 Priorities

| Rank | Item | Type | Score | Priority | Rationale |
|------|------|------|-------|----------|-----------|
| 1 | [Title] | Feature | 25.3 | P0 | [Reason] |
| 2 | [Title] | Bug | 18.7 | P0 | [Reason] |
| ... | ... | ... | ... | ... | ... |

## Key Decisions
- [Decision 1]: [Reasoning]
- [Decision 2]: [Reasoning]

## Trade-offs Made
- Chose [X] over [Y] because [reason]
- Deferred [Z] until [when] because [reason]

## Next Steps
1. [Action item]
2. [Action item]
3. [Action item]

## Review Date
[Date for next prioritization session]
```

Помните: Perfect prioritization невозможна. Цель: make better decisions faster, с transparent reasoning!
