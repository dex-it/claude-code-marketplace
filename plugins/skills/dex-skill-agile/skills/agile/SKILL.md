---
name: agile
description: Core Agile work hierarchy and terminology. Activate for epic vs story, INVEST criteria, DoR/DoD, work item types, sprint planning, sizing, prioritization basics.
allowed-tools: Read, Write, Edit
---

# Agile Fundamentals

Foundational Agile knowledge shared by all roles: PM, SA, developers, QA. Provides common language and methodology.

## Work Item Hierarchy

```
Portfolio / Theme
    |
Initiative (Strategic goal, 3-12 months)
    |
Epic (Large feature, 2-12 weeks)
    |
User Story (Deliverable increment, 1-5 days)
    |
Task (Technical subtask, hours to 1 day)
    |
Sub-task (Optional, granular work)
```

### Quick Reference

| Level | Description | Duration | Owner |
|-------|-------------|----------|-------|
| Initiative | Strategic goal aligned with OKRs | 3-12 months | Leadership |
| Epic | Large feature, doesn't fit one sprint | 2-12 weeks | PM |
| Story | Smallest value increment | 1-5 days | SA writes, Dev implements |
| Task | Technical implementation detail | hours to 1 day | Dev |

## Role Boundaries

**PM Domain**: Epic creation, roadmap planning, business metrics, strategic prioritization
**SA Domain**: User story writing, acceptance criteria, technical specs, process modeling
**Dev Domain**: Tasks, technical design, implementation, unit tests
**QA Domain**: Test cases, automation, bug reporting
**Shared**: Backlog refinement, sprint planning, INVEST validation

## INVEST Criteria

Every good user story should be:

| Criteria | Description | Example |
|----------|-------------|---------|
| **I**ndependent | Minimal dependencies, develop in any order | Story doesn't block other stories |
| **N**egotiable | Details emerge through conversation | AC refined during planning |
| **V**aluable | Clear benefit to user or business | "Users can export reports" |
| **E**stimable | Team can estimate complexity | Has clear scope |
| **S**mall | Fits within one sprint (1-8 points) | Not a multi-sprint epic |
| **T**estable | Clear acceptance criteria | Given-When-Then scenarios |

## Sizing Scale

### Fibonacci Points

```
1 Point:  Few hours (trivial change, config update)
2 Points: ~1 day (small feature, minor UI change)
3 Points: 1-2 days (medium complexity, new endpoint)
5 Points: 2-3 days (large feature, integration)
8 Points: 3-5 days (very large, cross-cutting concern)
13+ Points: Epic - MUST SPLIT into smaller stories
```

### T-Shirt Sizing

| Size | Points | When to use |
|------|--------|-------------|
| XS | 1 | Trivial, well-understood |
| S | 2 | Small, minimal risk |
| M | 3 | Medium, some unknowns |
| L | 5 | Large, significant work |
| XL | 8+ | Too large - must split |

## Definition of Ready (DoR)

Story ready for sprint planning:

```
[ ] Written in proper format (As a/I want/So that)
[ ] Business value clearly stated
[ ] Acceptance criteria defined (Given-When-Then)
[ ] Dependencies identified and resolved
[ ] Design/mockups available (if UI)
[ ] Technical approach feasible (groomed with dev)
[ ] Estimated by team
[ ] Fits within one sprint
[ ] No blockers present
```

## Definition of Done (DoD)

Story considered done:

```
[ ] Code implemented following standards
[ ] Code reviewed and approved
[ ] Unit tests written and passing
[ ] Integration tests passing (if applicable)
[ ] All acceptance criteria verified
[ ] Documentation updated (if needed)
[ ] Deployed to test environment
[ ] QA verified
[ ] Product Owner accepted
```

**Note**: Teams customize DoD based on their context and maturity.

## Prioritization Methods

### MoSCoW

| Priority | Description | Action |
|----------|-------------|--------|
| **M**ust Have | Critical, release fails without it | Do first |
| **S**hould Have | Important, but workarounds exist | Do if time permits |
| **C**ould Have | Nice to have, enhances UX | Do if easy |
| **W**on't Have | Explicitly out of scope | Don't do this release |

### Value vs Effort Matrix

```
        High Value
            |
   Big Bets | Quick Wins  <- Do First
   (plan)   | (do now)
------------+------------
  Time Sinks| Fill-ins
   (avoid)  | (maybe)
            |
        Low Value
   High Effort    Low Effort
```

### RICE Scoring

```
RICE Score = (Reach x Impact x Confidence) / Effort

Reach: Users affected per quarter (number)
Impact: 0.25 (minimal) to 3 (massive)
Confidence: 0.5 (low) to 1.0 (high)
Effort: Person-months
```

## Common Anti-Patterns

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| Water-Scrum-Fall | All stories written upfront | Refine just-in-time |
| Technical Tasks as Stories | "Refactor auth service" | Frame as user value |
| Massive Stories | 13+ points in sprint | Split to <=8 points |
| Missing AC | "Build feature X" | Add Given-When-Then |
| Dependency Chains | A -> B -> C -> D | Minimize or combine |
| No DoR | Unprepared stories enter sprint | Enforce readiness check |

## Sprint Ceremonies

| Ceremony | Duration | Purpose | Participants |
|----------|----------|---------|--------------|
| Planning | 2-4h | Select and commit to sprint work | Team + PO |
| Daily Standup | 15min | Sync, identify blockers | Dev Team |
| Review | 1-2h | Demo completed work | Team + Stakeholders |
| Retrospective | 1-2h | Process improvement | Team |
| Refinement | 1-2h/week | Groom upcoming stories | Team + PO |

## User Story Format

### Standard Format

```
As a [type of user]
I want [goal/desire]
So that [benefit/value]
```

### With Acceptance Criteria

```
As a registered user
I want to export my data as CSV
So that I can analyze it in Excel

Acceptance Criteria:
- Given I am on the dashboard
  When I click "Export" button
  Then a CSV file downloads with my data

- Given I have no data
  When I click "Export" button
  Then I see message "No data to export"
```

## Velocity and Capacity

### Velocity

- Average story points completed per sprint
- Use 3-sprint rolling average
- Don't compare velocities across teams

### Capacity Planning

```
Available Days = Team Size x Sprint Days - PTO - Meetings
Capacity = Available Days x Focus Factor (0.6-0.8)
Commitment = Velocity (adjusted for capacity)
```

## When to Use This Skill

This skill provides foundational Agile concepts. For role-specific details:

- **Product Managers**: See epic-planning, product-discovery, prioritization skills
- **System Analysts**: See user-stories, bpmn-modeling, api-specification skills
- **Developers**: See testing-patterns, code review guidelines
- **QA Engineers**: See test-design, api-testing skills

Ensures consistent terminology across the product development lifecycle.
