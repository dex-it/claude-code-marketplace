---
name: product-discovery
description: Активируется при исследовании проблем, валидации идей, customer discovery
allowed-tools: Read, Write, Edit, Grep, Glob
---

# Product Discovery Skill

Этот skill помогает Product Manager'у проводить discovery: понимать проблемы пользователей, валидировать идеи и находить product-market fit.

## Когда активируется

Используйте этот skill когда пользователь:
- Исследует новую feature идею
- Хочет понять user needs
- Проводит customer interviews
- Валидирует assumptions
- Ищет problem-solution fit
- Определяет target audience
- Анализирует competitor solutions

## Core Principles

### 1. Fall in Love with the Problem, Not the Solution

```
❌ "We need to build X feature"
✅ "Users struggle with Y problem"

Сначала глубоко understand problem,
только потом brainstorm solutions.
```

### 2. Jobs-to-be-Done Framework

```
Users "hire" products to do a job.

Format: "When [situation], I want to [motivation], so I can [outcome]"

Example:
"When I'm reviewing code, I want to quickly spot potential bugs,
so I can maintain high quality without slowing down the team"

Focus on:
- Job to be done (functional)
- Emotional job (how they want to feel)
- Social job (how they want to be perceived)
```

### 3. Validate Before Build

```
Assumption → Hypothesis → Experiment → Learn

Не начинайте development пока:
1. Проблема validated (users действительно испытывают её)
2. Solution validated (ваше решение работает)
3. Value validated (users готовы use/pay)
```

## Discovery Process

### Phase 1: Problem Discovery

**Goal:** Найти real, important проблему

**Methods:**

**User Interviews**
```
Подготовка:
- Определите target segment
- Подготовьте interview guide (open-ended questions)
- Recruit 5-10 users

Questions to Ask:
- "Tell me about the last time you [did related task]"
- "What's the hardest part of [problem area]?"
- "How do you currently solve this?"
- "What have you tried?"
- "If you had a magic wand, what would you change?"

Don't Ask:
- "Would you use feature X?" (they'll lie)
- Leading questions
- Yes/no questions

Listen for:
- Pain points (frustration, time waste)
- Workarounds (что они придумали)
- Frequency (как часто problem occurs)
- Impact (насколько серьёзно)
```

**Observational Research**
```
Watch users работать:
- Где они struggle?
- Какие workarounds?
- Что занимает время?
- Где errors происходят?

Often reveals problems users не articulate.
```

**Data Analysis**
```
Analyze existing data:
- Support tickets (частые complaints)
- Feature requests (what users ask for)
- Analytics (где drop-off, где spend time)
- Churn surveys (почему leave)

Look for patterns, не anecdotes.
```

**Problem Statement**
```
Template:
[User type] needs a way to [need/job]
because [insight about problem].

Example:
"Junior developers need a way to understand complex codebases
because they spend 50% of their time navigating unfamiliar code,
leading to slower velocity and frustration."

Good problem statement:
✅ Specific user type
✅ Clear need
✅ Insight о причине
✅ Quantified if possible
```

### Phase 2: Solution Discovery

**Goal:** Найти best solution для validated problem

**Ideation**
```
Techniques:
- Brainstorming (quantity over quality)
- Crazy 8s (8 ideas in 8 minutes)
- Competitor analysis (what exists?)
- Jobs-to-be-Done breakdown (что нужно для job?)

Generate много options, не commit сразу.
```

**Solution Hypotheses**
```
Format:
"We believe that [solution] will [outcome]
for [user segment] because [reasoning]."

Example:
"We believe that adding inline code explanations
will reduce time-to-understanding by 30%
for junior developers
because they currently spend time searching documentation."

Make it:
- Specific (measurable outcome)
- Testable (can validate)
- Falsifiable (could be wrong)
```

**Rapid Prototyping**
```
Build minimum для testing:
- Paper sketches
- Figma mockups
- Clickable prototype
- Fake door test (landing page)
- Concierge MVP (manual process)
- Wizard of Oz (fake automation)

Goal: learn, не build perfect product.
```

**Testing**
```
Methods:
- Prototype testing (5-8 users)
- Fake door (track clicks on "coming soon")
- Pre-sales (who'll commit to buy?)
- Beta program (limited rollout)

Metrics:
- Usability: can they use it?
- Value: do they want it?
- Willingness to pay: will they pay?
```

### Phase 3: Market Discovery

**Goal:** Understand market, competition, positioning

**Market Sizing**
```
TAM (Total Addressable Market): everyone who could use it
SAM (Serviceable Addressable Market): who you can reach
SOM (Serviceable Obtainable Market): who you'll realistically get

Example:
TAM: All developers (25M globally)
SAM: .NET developers (2M)
SOM: .NET enterprise devs (100K realistic to reach)
```

**Competitor Analysis**
```
For each competitor:
- What problem do they solve?
- How? (feature set)
- For whom? (target segment)
- Strengths / Weaknesses
- Pricing
- Market positioning

Your differentiation:
- What can you do better?
- What underserved segment?
- What unique insight?
```

**Positioning**
```
Template:
For [target customer]
Who [statement of need]
Our product is a [product category]
That [key benefit]
Unlike [primary competitor]
We [primary differentiation]

Be specific, not generic.
```

## Discovery Techniques

### 1. Customer Interviews

**Structure:**
```
1. Intro (5 min): set context, build rapport
2. Understand Context (15 min): their workflow, environment
3. Explore Problems (25 min): pain points, needs
4. Solution Feedback (10 min): если есть prototype
5. Wrap-up (5 min): anything else? can we follow up?

Total: ~60 min
```

**Interview Tips:**
```
Do:
- Ask "why" 5 times (5 Whys technique)
- Request specific examples ("tell me about last time...")
- Stay curious, не defensive
- Listen 80%, talk 20%
- Take notes (или record с permission)

Don't:
- Pitch your solution
- Lead the witness ("wouldn't you love X?")
- Ask hypotheticals ("would you use...?")
- Ignore negative feedback
- Interview friends/family (biased)
```

### 2. Problem/Solution Fit Canvas

```
PROBLEM SIDE:
- Customer Segments: who has problem?
- Problems: top 3 problems
- Existing Alternatives: what they use now
- Early Adopters: who needs it most urgently?

SOLUTION SIDE:
- Solution: high-level approach
- Key Metrics: how measure success?
- Unique Value Proposition: why you?
- Unfair Advantage: hard to copy?
- Channels: how reach users?
- Cost Structure: what costs?
- Revenue Streams: how monetize?
```

### 3. Assumption Mapping

```
List all assumptions:
- Users have problem X
- Users will pay $Y
- We can build it in Z time
- Distribution channel W works

For each:
- Importance: high/medium/low
- Evidence: none/some/validated

Focus testing на:
High importance + No evidence = risky, test first!
```

### 4. Opportunity Solution Tree

```
          [Desired Outcome]
                 |
        ---------------------
        |                   |
   [Opportunity 1]    [Opportunity 2]
        |                   |
   -----------         -----------
   |    |    |         |    |    |
 [S1] [S2] [S3]     [S4] [S5] [S6]

Outcome: business goal (OKR)
Opportunities: user needs/problems that drive outcome
Solutions: ideas to address opportunities

Helps visualize options and make trade-offs.
```

### 5. Story Mapping

```
User Journey →  [Step 1] → [Step 2] → [Step 3] → [Step 4]
                    |          |          |          |
                 Tasks:     Tasks:     Tasks:     Tasks:
                 - Task A   - Task D   - Task F   - Task H
                 - Task B   - Task E   - Task G   - Task I
                 - Task C                          - Task J

Horizontal: user journey (sequence)
Vertical: priority (top = MVP, bottom = later)

Helps decide what to build first.
```

## Validation Techniques

### 1. Fake Door Testing

```
Create:
- Landing page describing feature
- "Sign up for early access" button

Measure:
- Click-through rate
- Email sign-ups
- Conversion vs other features

Learn:
- Demand level
- Which messaging works
- Who's interested
```

### 2. Concierge MVP

```
Manually do what product would do:
- No automation
- Personal service
- Learn deeply

Example:
Before building automated code review tool,
manually review code for 10 teams.

Learn:
- What value really matters?
- What patterns emerge?
- What's hard to automate?
```

### 3. Wizard of Oz

```
Users think it's automated, but humans behind scenes.

Example:
"AI-powered" feature that's actually human analysts.

Learn:
- Is the output valuable?
- What edge cases?
- What accuracy needed?
```

### 4. Beta Testing

```
Limited release to segment:
- Early adopters
- Friendly customers
- Internal teams

Gather:
- Usage data
- Feedback sessions
- Support tickets
- Retention metrics

Iterate before full launch.
```

## Discovery Artifacts

### 1. User Personas

```
[Photo]

Name: "Developer Dan"
Role: Senior .NET Developer
Age: 32
Experience: 8 years

Goals:
- Write clean, maintainable code
- Mentor junior devs
- Meet sprint commitments

Frustrations:
- Noisy PR reviews
- Context switching
- Unclear requirements

Behaviors:
- Checks email 3x/day
- Active on Stack Overflow
- Prefers Slack over email

Quote: "I want tools that help me focus, not distract me."

Helps team empathize с users.
```

### 2. Journey Map

```
[Awareness] → [Consideration] → [Purchase] → [Onboarding] → [Usage] → [Renewal]
     |              |               |             |            |           |
  Touchpoints    Touchpoints    Touchpoints   Touchpoints  Touchpoints Touchpoints
  Emotions       Emotions       Emotions      Emotions     Emotions    Emotions
  Pain Points    Pain Points    Pain Points   Pain Points  Pain Points Pain Points

Visualizes entire customer experience.
Identifies improvement opportunities.
```

### 3. Value Proposition Canvas

```
CUSTOMER PROFILE:
Jobs: what trying to accomplish?
Pains: bad outcomes, risks, obstacles
Gains: outcomes and benefits they want

VALUE MAP:
Products & Services: what you offer
Pain Relievers: how alleviate pains
Gain Creators: how create gains

Fit = Pain Relievers match Pains + Gain Creators match Gains
```

## Questions to Always Ask

### About the Problem

```
1. Who exactly has this problem?
2. When does it occur?
3. How often?
4. What's the impact? (time, money, frustration)
5. What do they currently do?
6. Why don't current solutions work?
7. How important is solving this? (1-10)
8. What would happen if not solved?
```

### About the Solution

```
1. Does this actually solve the problem?
2. Is it usable by target users?
3. Is it 10x better than alternatives? (need big improvement)
4. What's the smallest version that delivers value?
5. What can go wrong?
6. What assumptions are we making?
7. How will we measure success?
8. What's the plan to validate quickly?
```

### About the Market

```
1. How big is the opportunity? (TAM/SAM/SOM)
2. Who else is solving this?
3. Why will customers choose us?
4. How will we reach them?
5. What's the business model?
6. Unit economics: CAC < LTV?
7. Can this scale?
8. What are the risks?
```

## Red Flags

Watch out for:

```
❌ "Everyone needs this" → Too broad, no focus
❌ "No competitors" → Maybe no market?
❌ "We just need to build it" → Skipping validation
❌ "Users will change behavior" → Hard to do
❌ "Experts love it" → Not your target user?
❌ Feature list with no problem → Solution looking for problem
❌ "We'll monetize later" → No business model
❌ Perfect plan → Reality will differ
```

## Discovery Checklist

Before moving to build:

**Problem Validation:**
- [ ] Talked to 10+ potential users
- [ ] Problem occurs frequently (weekly+)
- [ ] Users actively seeking solutions
- [ ] Current solutions unsatisfactory
- [ ] Users willing to change behavior/pay

**Solution Validation:**
- [ ] Prototype tested with 5-8 users
- [ ] Users can complete key tasks
- [ ] Users see clear value
- [ ] Solution 10x better than alternatives
- [ ] MVP scope defined

**Market Validation:**
- [ ] Market size estimated (TAM/SAM/SOM)
- [ ] Competitors analyzed
- [ ] Differentiation clear
- [ ] Go-to-market plan exists
- [ ] Business model validated
- [ ] Unit economics positive

## Resources & Templates

При использовании этого skill, предлагайте:

1. **Interview Scripts**: готовые вопросы для interviews
2. **Research Plans**: templates для planning discovery
3. **Synthesis Tools**: affinity mapping, theme extraction
4. **Validation Frameworks**: hypothesis testing formats
5. **Documentation**: записывайте findings в Notion

## Output Format

После discovery session, создавайте:

```markdown
# Discovery Summary: [Topic]

## Problem Statement
[Clear problem definition]

## Research Conducted
- Method: [interviews/data/etc]
- Sample: [who, how many]
- Dates: [when]

## Key Findings
1. [Finding with evidence]
2. [Finding with evidence]
3. [Finding with evidence]

## User Insights
- [Insight 1]
- [Insight 2]
- [Insight 3]

## Validated Hypotheses
✅ [Hypothesis 1]: [Evidence]
✅ [Hypothesis 2]: [Evidence]

## Invalidated Hypotheses
❌ [Hypothesis 3]: [Evidence]

## Recommended Next Steps
1. [Action item]
2. [Action item]
3. [Action item]

## Open Questions
- [Question 1]
- [Question 2]

## Artifacts
- Interview notes: [link]
- Prototype: [link]
- Data analysis: [link]
```

## Remember

Discovery - это не одноразовый процесс. Continuous discovery:
- Every sprint: talk to customers
- Every feature: validate assumptions
- Every release: measure impact
- Always: stay curious

Great PM's spend 50%+ времени на discovery, not delivery. Understand проблему глубоко = build правильную вещь!
