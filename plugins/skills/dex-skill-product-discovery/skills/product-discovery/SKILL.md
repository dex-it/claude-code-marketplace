---
name: product-discovery
description: Активируется при исследовании проблем, валидации идей, customer discovery, user interviews, problem-solution fit, market validation
allowed-tools: Read, Write, Edit, Grep, Glob
---

# Product Discovery Skill

Помогает PM проводить discovery: понимать проблемы пользователей, валидировать идеи, находить product-market fit.

## Core Principles

**1. Problem First, Solution Second**
❌ "Build X" → ✅ "Users struggle with Y"

**2. Jobs-to-be-Done:** "When [situation], I want to [motivation], so I can [outcome]"

**3. Validate Before Build:** Assumption → Hypothesis → Experiment → Learn

## 3-Phase Discovery Process

### Phase 1: Problem Discovery

**Goal:** Validate real, important problem

**User Interviews (5-10 users)**
- Ask: "Tell me about last time you [task]", "What's hardest part?", "How solve now?"
- Don't: "Would you use X?", leading questions, yes/no
- Listen for: Pain points, workarounds, frequency, impact

**Data Sources:** Support tickets, analytics drop-offs, churn surveys, feature requests

**Problem Statement Template:**
[User type] needs [job] because [insight + quantified impact]

Example: "Junior devs need codebase navigation help because they spend 50% time on it, slowing velocity"

### Phase 2: Solution Discovery

**Goal:** Find best solution for validated problem

**Hypothesis Format:**
"We believe [solution] will [measurable outcome] for [segment] because [reasoning]"

**Rapid Prototyping:** Paper sketches → Figma → Clickable prototype → Fake door → Concierge/Wizard of Oz MVP

**Testing (5-8 users):**
- Usability: Can use it?
- Value: Want it?
- Willingness to pay: Will pay?

### Phase 3: Market Discovery

**Market Sizing:** TAM (all who could use) → SAM (can reach) → SOM (will realistically get)

**Competitor Analysis:** Problem, Solution, Target, Strengths/Weaknesses, Pricing, Differentiation

**Positioning Template:**
For [customer] who [need], our [category] provides [benefit]. Unlike [competitor], we [differentiation].

## Key Techniques

**Customer Interviews (60 min):** Intro (5) → Context (15) → Problems (25) → Feedback (10) → Wrap (5)
- Do: Ask "why" 5x, specific examples, listen 80%
- Don't: Pitch, lead, hypotheticals, interview friends

**Assumption Mapping:** List assumptions → Rate (Importance × Evidence) → Test high-risk first

**Opportunity Solution Tree:** Outcome → Opportunities → Solutions (visualize options)

## Validation Methods

**Fake Door:** Landing page + "early access" → Measure clicks/signups → Learn demand

**Concierge MVP:** Manually deliver service → Learn value/patterns before automating

**Wizard of Oz:** Fake automation (humans behind) → Test if output valuable

**Beta Testing:** Limited release → Usage data + feedback → Iterate before launch

## Discovery Artifacts

**User Personas:** Name, Role, Goals, Frustrations, Behaviors, Quote → Team empathy

**Journey Map:** [Stage] → Touchpoints + Emotions + Pain Points → Find opportunities

**Value Prop Canvas:** Customer (Jobs/Pains/Gains) ↔ Value Map (Products/Pain Relievers/Gain Creators)

## Critical Questions

**Problem:** Who? When? How often? Impact? Current solution? Why not working? Importance (1-10)?

**Solution:** Solves problem? Usable? 10x better? Smallest valuable version? Assumptions? Success metrics?

**Market:** TAM/SAM/SOM? Competitors? Why us? Distribution? Business model? CAC < LTV? Scalable?

## Red Flags

❌ "Everyone needs this" | "No competitors" | "Just build it" | "Users will change" | Feature list без problem

## Pre-Build Checklist

**Problem:** 10+ interviews, frequent occurrence, users seeking solutions, willing to pay
**Solution:** Tested with 5-8 users, clear value, 10x better, MVP defined
**Market:** TAM/SAM/SOM sized, competitors analyzed, differentiation clear, positive unit economics

## Output Format

После discovery создавайте в Notion:

```markdown
# Discovery: [Topic]

**Problem:** [Clear definition]
**Research:** [Method, Sample, Dates]

**Key Findings:**
1-3 findings с evidence

**Validated:** ✅ [Hypothesis]: [Evidence]
**Invalidated:** ❌ [Hypothesis]: [Evidence]

**Next Steps:** 1-3 action items
**Open Questions:** Remaining uncertainties
```

## Remember

Continuous discovery: Every sprint talk to customers, validate assumptions, measure impact. Great PMs spend 50%+ time on discovery.
