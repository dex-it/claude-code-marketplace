---
name: agile-fundamentals
description: Core Agile work hierarchy and terminology. Activate for epic vs story, INVEST criteria, DoR/DoD, work item types, sprint planning basics.
allowed-tools: Read, Write, Edit
---

# Agile Fundamentals

Foundational Agile knowledge shared by PM and SA roles. Provides common language without role-specific implementation details.

## Work Item Hierarchy

```
Portfolio / Theme
    ↓
Initiative (Strategic goal, 3-12 months)
    ↓
Epic (Large feature, 2-12 weeks)
    ↓
User Story (Deliverable increment, 1-5 days)
    ↓
Task (Technical subtask, hours to 1 day)
    ↓
Sub-task (Optional, granular work)
```

### Quick Reference

**Initiative**: Strategic goal aligned with company OKRs (3-12 months)
**Epic**: Large feature that doesn't fit in one sprint (2-12 weeks) - PM owns
**Story**: Smallest increment of value deliverable in sprint (1-5 days) - SA writes
**Task**: Technical work item, implementation detail (hours to 1 day) - Dev owns

## Role Boundaries

**PM Domain**: Epic creation, roadmap planning, business metrics, strategic prioritization
**SA Domain**: User story writing, acceptance criteria, technical specs, process modeling
**Shared**: Backlog refinement, sprint planning, INVEST validation

*Detailed role separation and collaboration flow: see CLAUDE.md section "Разделение ролей"*

## INVEST Criteria

Every good user story should be:

**Independent**: Minimal dependencies, can be developed in any order
**Negotiable**: Details emerge through conversation, not complete spec
**Valuable**: Clear benefit to user or business
**Estimable**: Team can estimate complexity/effort
**Small**: Fits within one sprint (1-8 points)
**Testable**: Clear acceptance criteria, objectively verifiable

## Sizing Scale

**Fibonacci**: 1, 2, 3, 5, 8, 13, 21

```
1 Point:  Few hours (trivial change)
2 Points: ~1 day (small feature)
3 Points: 1-2 days (medium complexity)
5 Points: 2-3 days (large feature)
8 Points: 3-5 days (very large, cross-cutting)
13+ Points: Epic - must split
```

**T-Shirt Sizing**: XS (1), S (2), M (3), L (5), XL (8+ - split)

## Definition of Ready (DoR)

Story ready for sprint planning when:

```
☑ Written in proper format (Epic/Story/Task)
☑ Business value clearly stated
☑ Acceptance criteria defined
☑ Dependencies identified
☑ Design/mockups available (if UI)
☑ Technical approach feasible
☑ Estimated by team
☑ Fits within one sprint
☑ No blockers present
```

## Definition of Done (DoD)

Story considered done when:

```
☑ Code implemented following standards
☑ Code reviewed and approved
☑ Tests written and passing
☑ All acceptance criteria verified
☑ Documentation updated
☑ Deployed to test environment
☑ Product Owner accepted
```

**Note**: Teams customize DoD based on context.

## Common Anti-Patterns

**Water-Scrum-Fall**
❌ Writing all stories upfront in complete detail
✅ Keep distant work high-level, refine just-in-time

**Technical Tasks as Stories**
❌ "Refactor authentication service"
✅ "Improve login reliability for users"

**Massive Stories**
❌ 13+ point stories in sprint
✅ Break down to ≤8 points

**Missing Acceptance Criteria**
❌ "Build feature X" (vague)
✅ Clear Given-When-Then scenarios

**Too Many Dependencies**
❌ Story A → blocks → Story B → blocks → Story C
✅ Minimize dependencies, or combine stories

## Prioritization Methods

**MoSCoW**: Must Have | Should Have | Could Have | Won't Have

**Value vs Effort Matrix**:
- High Value, Low Effort: Do First (Quick Wins)
- High Value, High Effort: Plan Carefully (Big Bets)
- Low Value, Low Effort: Maybe Later (Fill-Ins)
- Low Value, High Effort: Avoid (Time Sinks)

*For RICE scoring and detailed prioritization frameworks, see epic-planning skill.*

## When to Use This Skill

This skill provides common language and concepts for both PM and SA roles. For role-specific details:

- **Product Managers**: Use epic-planning, product-discovery skills
- **System Analysts**: Use user-stories, bpmn-modeling skills

Ensures consistent terminology across the product development lifecycle.
