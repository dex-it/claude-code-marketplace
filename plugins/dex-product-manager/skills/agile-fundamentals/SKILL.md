---
name: agile-fundamentals
description: Core Agile concepts, terminology, and hierarchy shared across PM and SA roles. Activate when discussing Agile basics, work item hierarchy, or general Agile practices.
allowed-tools: Read, Write, Edit
---

# Agile Fundamentals Skill

This skill provides foundational Agile knowledge shared between Product Managers and System Analysts. It covers core concepts without going into role-specific implementation details.

## Agile Work Item Hierarchy

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

### Terminology

**Portfolio/Theme**: Strategic business area or major product direction

**Initiative**: Large strategic goal aligned with company OKRs
- Timeframe: 3-12 months
- Ownership: Product leadership
- Example: "Expand into mobile market", "Improve platform security"

**Epic**: Large feature or capability that doesn't fit in one sprint
- Timeframe: 2-12 weeks
- Ownership: Product Manager
- Must have: Business value, success metrics, high-level scope
- Example: "Payment Integration", "User Dashboard Redesign"

**User Story**: Smallest increment of value deliverable in a sprint
- Timeframe: 1-5 days
- Ownership: System Analyst (writes), Development Team (implements)
- Must have: User value, acceptance criteria
- Format: "As a [role], I want [feature], so that [benefit]"

**Task**: Technical work item, implementation detail of a story
- Timeframe: Hours to 1 day
- Ownership: Developer
- Example: "Create API endpoint", "Write unit tests", "Add migration"

**Sub-task**: Optional granular breakdown of a task
- Timeframe: Minutes to hours
- Example: "Add validation", "Update error handling"

## Role Boundaries

### Product Manager Domain
- **What**: Epic creation and management
- **What**: Strategic prioritization (roadmap level)
- **What**: Business value definition
- **What**: Success metrics and KPIs
- **What**: Stakeholder alignment
- **Not**: Detailed user story writing
- **Not**: Technical acceptance criteria
- **Not**: Implementation specifications

### System Analyst Domain
- **What**: User story writing from epics
- **What**: Detailed acceptance criteria (Given-When-Then)
- **What**: Requirements decomposition
- **What**: Process modeling (BPMN)
- **What**: API specifications (OpenAPI)
- **Not**: Roadmap planning
- **Not**: Business metrics analysis
- **Not**: Strategic prioritization

### Shared Responsibilities
- **Both**: Backlog refinement sessions
- **Both**: Sprint planning participation
- **Both**: Understanding INVEST criteria
- **Both**: Definition of Ready/Done awareness

## INVEST Criteria (Applies to Stories)

Every good user story should be:

**Independent**
- Can be developed in any order
- Minimal dependencies on other stories
- Can be delivered separately

**Negotiable**
- Details emerge through conversation
- Not a contract or complete spec
- Implementation approach can be discussed

**Valuable**
- Delivers clear benefit to user or business
- Stakeholder can explain why it matters
- Moves product toward vision

**Estimable**
- Team can estimate complexity/effort
- Enough detail to size
- Technical approach is feasible

**Small**
- Fits within one sprint (1-2 weeks)
- Typically 1-5 days of work
- Can be completed by 1-2 developers

**Testable**
- Clear acceptance criteria exist
- Success can be objectively verified
- Both manual and automated tests possible

## Story Sizing Reference

**Fibonacci Scale**: 1, 2, 3, 5, 8, 13, 21

```
1 Point: Few hours
- Trivial change
- Well understood
- Example: "Update button label", "Change config value"

2 Points: ~1 day
- Small feature
- Clear approach
- Example: "Add form validation", "Simple CRUD endpoint"

3 Points: 1-2 days
- Medium complexity
- Multiple components
- Example: "Password reset flow", "Email notifications"

5 Points: 2-3 days
- Large feature
- Multiple services/files
- Example: "OAuth integration", "Advanced search"

8 Points: 3-5 days
- Very large story
- Cross-cutting changes
- Example: "Real-time notifications", "Report generation"

13+ Points: Too large
- Should be broken down into smaller stories
- This is actually an epic
- Example: "Complete checkout flow", "Admin dashboard"
```

**T-Shirt Sizing** (Alternative):
- XS: Trivial (1 point)
- S: Small (2 points)
- M: Medium (3 points)
- L: Large (5 points)
- XL: Epic - must split (8+ points)

## Definition of Ready (DoR)

A story is ready for sprint planning when:

```
☑ Written in proper format (Epic/Story/Task)
☑ Business value clearly stated
☑ Acceptance criteria defined
☑ Dependencies identified
☑ Design/mockups available (if UI work)
☑ Technical approach feasible
☑ Estimated by team
☑ Fits within one sprint
☑ No blockers present
```

## Definition of Done (DoD)

A story is considered done when:

```
☑ Code implemented following standards
☑ Code reviewed and approved
☑ Unit tests written (minimum coverage met)
☑ Integration tests passing
☑ All acceptance criteria verified
☑ Documentation updated
☑ Deployed to test environment
☑ Product Owner accepted
```

**Note**: Teams customize DoD based on context (startup vs enterprise, web vs mobile, etc.)

## Common Anti-Patterns

### Water-Scrum-Fall
❌ Writing all stories upfront in complete detail
✅ Keep distant work high-level, refine just-in-time

### Technical Tasks as Stories
❌ "Refactor authentication service"
✅ "Improve login reliability for users"
*Frame even technical work with user value*

### Massive Stories
❌ 21+ point stories in sprint
✅ Break down to ≤8 points
*Large stories = high risk, poor estimates*

### Missing Acceptance Criteria
❌ "Build feature X" (vague)
✅ Clear Given-When-Then scenarios
*How do you know when it's done?*

### Too Many Dependencies
❌ Story A → blocks → Story B → blocks → Story C
✅ Minimize dependencies, or combine stories
*Dependencies = delays and complexity*

## Agile Ceremonies (Context)

**Sprint Planning**:
- PM presents prioritized backlog
- SA clarifies stories
- Team commits to sprint goal

**Daily Standup**:
- What did I do yesterday?
- What will I do today?
- Any blockers?

**Backlog Refinement**:
- PM brings upcoming work
- SA adds details to stories
- Team estimates and asks questions

**Sprint Review**:
- Demo completed work
- PM validates against acceptance criteria
- Stakeholders provide feedback

**Retrospective**:
- What went well?
- What could improve?
- Action items for next sprint

## Prioritization Frameworks (High-Level)

### MoSCoW
- **Must Have**: Critical for release
- **Should Have**: Important but not blocker
- **Could Have**: Nice to have if time permits
- **Won't Have**: Not in this release

### RICE Scoring
```
RICE = (Reach × Impact × Confidence) / Effort

Reach: How many users affected
Impact: Value per user (0.5, 1, 2, 3)
Confidence: Certainty % (50%, 80%, 100%)
Effort: Time/resources required
```

### Value vs Effort Matrix
```
High Value, Low Effort:  Do First (Quick Wins)
High Value, High Effort: Plan Carefully (Big Bets)
Low Value, Low Effort:   Maybe Later (Fill-Ins)
Low Value, High Effort:  Avoid (Time Sinks)
```

## Best Practices

1. **Progressive Elaboration**: Add detail as work approaches
2. **Small Batches**: Smaller stories = faster feedback
3. **User Language**: Write how users speak, not developers
4. **Measurable Outcomes**: Specific success criteria
5. **Continuous Refinement**: Living backlog, not static plan
6. **Collaborative**: PM + SA + Developers work together
7. **Visual Management**: Use boards, labels, colors
8. **Balance Work Types**: Features + Bugs + Tech Debt (60/20/20)

## Resources & Templates

### Quick Story Template
```markdown
As a [role]
I want [action]
So that [benefit]

AC:
- [ ] Given [context], When [action], Then [outcome]

Est: [points] | Priority: [Must/Should/Could/Won't]
```

### Quick Epic Template
```markdown
Epic: [Name]
Value: [Why important?]
Scope: [What's included?]
Success: [How to measure?]
Timeline: [Target quarter]
```

## When to Use This Skill

This skill provides the common language and concepts for both PM and SA roles. For role-specific details:

- **Product Managers**: Use role-specific skills for epic planning, roadmapping, metrics
- **System Analysts**: Use role-specific skills for story writing, acceptance criteria, technical specs

This skill ensures consistent terminology and understanding across the product development lifecycle.
