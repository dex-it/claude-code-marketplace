---
name: agile-artifacts
description: Активируется при работе с agile артефактами - epics, stories, tasks, acceptance criteria
allowed-tools: Read, Write, Edit
---

# Agile Artifacts Skill

Этот skill помогает Product Manager'у правильно структурировать и документировать agile артефакты: epics, user stories, tasks, acceptance criteria.

## Когда активируется

Используйте этот skill когда:
- Создаёте или редактируете epics
- Пишете user stories
- Разбиваете работу на tasks
- Определяете acceptance criteria
- Проводите refinement/grooming
- Готовите backlog к sprint planning
- Структурируете feature decomposition

## Agile Hierarchy

```
Portfolio / Theme
    ↓
Initiative (Strategic goal)
    ↓
Epic (Large feature, 2-12 weeks)
    ↓
User Story (Deliverable increment, 1-5 days)
    ↓
Task (Technical subtask, hours to 1 day)
    ↓
Sub-task (Optional, granular work)
```

## Epic

**Definition:** Большая feature или инициатива, которая не fit в один sprint.

### Epic Structure

```markdown
# [Epic Title]
Краткое, описательное название (3-5 слов)

## Problem Statement
Какую проблему решаем? Для кого?

**Current State:**
Что происходит сейчас? В чём pain?

**Desired State:**
Как должно быть?

## Business Value
- Зачем это важно?
- Какой impact на business metrics?
- Alignment с strategic goals?

## Success Metrics
Как measure успех?
- Primary metric: [главная метрика]
- Target: [конкретная цель]
- Secondary metrics: [supporting metrics]

## High-Level Scope
Что включает epic (общее описание)?

**In Scope:**
- [Feature area 1]
- [Feature area 2]

**Out of Scope:**
- [Explicitly что НЕ включено]

## User Stories (High-Level)
Список major stories:
1. As a [user], I want [feature] so that [benefit]
2. As a [user], I want [feature] so that [benefit]

[Детальные stories создаются later]

## Dependencies
- Depends on: [Other epics/work]
- Blocks: [What this enables]

## Risks
- [Risk 1]: [Mitigation]
- [Risk 2]: [Mitigation]

## Timeline
- Target Start: [Quarter/Month]
- Target End: [Quarter/Month]
- Estimated Effort: [Story points / person-weeks]

## Definition of Done
Epic считается done когда:
- [ ] All user stories completed
- [ ] Success metrics achieved
- [ ] Acceptance criteria met
- [ ] Tested and deployed
- [ ] Documented
- [ ] Stakeholders approved
```

### Epic Best Practices

**Size:**
```
✅ 2-12 weeks work
❌ <2 weeks → это story, не epic
❌ >1 quarter → break на smaller epics
```

**Focus:**
```
✅ Single theme/feature area
✅ Clear business value
✅ Measurable outcome
❌ Multiple unrelated features
❌ "Miscellaneous improvements"
```

**Examples:**
```
Good Epic Titles:
- "Mobile App Redesign"
- "Payment Integration"
- "Multi-language Support"
- "Advanced Search"

Bad Epic Titles:
- "Improvements" (too vague)
- "Tech Debt" (too broad)
- "Fix Bugs" (not an epic)
```

## User Story

**Definition:** Наименьший increment of value, deliverable в рамках sprint.

### User Story Format

```
As a [type of user]
I want [action/feature]
So that [benefit/value]

Acceptance Criteria:
Given [context/precondition]
When [action/event]
Then [expected outcome]

[Additional criteria...]
```

### User Story Template

```markdown
# [Story Title]

## User Story
As a [persona/role]
I want [capability]
So that [benefit]

## Context
[Why this story? Background information]

## Acceptance Criteria

### Scenario 1: [Happy Path]
Given [initial state]
When [action]
Then [expected result]

### Scenario 2: [Edge Case]
Given [different state]
When [action]
Then [expected result]

### Scenario 3: [Error Case]
Given [error condition]
When [action]
Then [error handling]

## Design Notes
- [Links to mockups/wireframes]
- [UI/UX considerations]

## Technical Notes
- [API endpoints]
- [Database changes]
- [Integration points]
- [Performance requirements]

## Dependencies
- Depends on: [Other stories]
- Related to: [Epic, other stories]

## Definition of Done
- [ ] Code complete
- [ ] Unit tests written and passing
- [ ] Integration tests passing
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified
- [ ] Deployed to staging
- [ ] PO accepted
- [ ] Documentation updated

## Estimate
Story Points: [1/2/3/5/8/13]
```

### INVEST Criteria (Good Story)

```
I - Independent
  ✅ Can be developed in any order
  ❌ Tightly coupled to другим stories

N - Negotiable
  ✅ Details discussed с team
  ❌ Over-specified до discussion

V - Valuable
  ✅ Delivers value to user
  ❌ Purely technical, no user value

E - Estimable
  ✅ Team может estimate effort
  ❌ Too vague to estimate

S - Small
  ✅ Fits in one sprint (1-5 days)
  ❌ Weeks of work

T - Testable
  ✅ Clear acceptance criteria
  ❌ Subjective, can't verify
```

### Story Sizing

**Fibonacci Scale:** 1, 2, 3, 5, 8, 13, 21

```
1 Point: Few hours
- Simple config change
- Minor text update
- Trivial bug fix
Example: "Change button label"

2 Points: ~1 day
- Small feature
- Simple form
- Standard CRUD
Example: "Add validation to form field"

3 Points: 1-2 days
- Medium feature
- Multiple components
- Some complexity
Example: "Implement password reset flow"

5 Points: 2-3 days
- Large feature
- Multiple files/services
- Integration work
Example: "Add OAuth login"

8 Points: 3-5 days
- Very large feature
- Cross-cutting changes
- Significant complexity
Example: "Real-time notifications system"

13 Points: 1 week
- Epic-sized
- Should be broken down
Example: "User dashboard redesign"

21+: Too large
- Must break down
- Not a story, это epic
```

**T-Shirt Sizing** (Alternative):
```
XS: trivial
S: small
M: medium
L: large
XL: epic (break down)
```

### Story Examples

**Good Story:**
```
Title: Password Reset via Email

As a registered user
I want to reset my password via email
So that I can regain access if I forget my password

Acceptance Criteria:
1. Email Delivery:
   Given I'm on login page
   When I click "Forgot Password" and enter my email
   Then I receive password reset email within 5 minutes

2. Reset Link:
   Given I received reset email
   When I click the reset link
   Then I'm taken to password reset page
   And link is valid for 24 hours

3. Password Update:
   Given I'm on password reset page
   When I enter new password (min 8 chars) and confirm
   Then my password is updated
   And I'm logged in automatically
   And old password no longer works

4. Security:
   Given reset link is >24 hours old
   When I try to use it
   Then I see error: "Link expired"
   And I can request new link

Estimate: 5 points
```

**Bad Story (Too Technical):**
```
❌ "Refactor authentication service"

Problems:
- Not user-facing value
- No acceptance criteria
- Technical implementation, not user need

Better:
✅ "Improve login reliability"
As a user, I want login to work consistently
So that I don't get frustrated with errors

[Then describe technical approach in notes]
```

**Bad Story (Too Large):**
```
❌ "Build entire checkout flow"

Problem: Too big for one sprint

Better: Break down:
✅ "Display cart summary"
✅ "Enter shipping address"
✅ "Select payment method"
✅ "Review and confirm order"
✅ "Order confirmation page"
```

**Bad Story (No Value):**
```
❌ "Update npm packages"

Problem: No user value stated

Better:
✅ "Improve app security by updating dependencies"
So that users' data is protected from known vulnerabilities

[Technical task, но с user benefit]
```

## Task

**Definition:** Technical work item, subtask of a story.

### Task Structure

```markdown
# [Task Title]

Parent Story: [Link to story]

## Description
What needs to be done?

## Technical Details
- Files to modify: [list]
- APIs to update: [list]
- Database changes: [migrations needed]

## Steps
1. [Step 1]
2. [Step 2]
3. [Step 3]

## Acceptance
- [ ] [What must be done]
- [ ] [Tests passing]
- [ ] [Code reviewed]

## Estimate
[Hours: 2-8]
```

### Task Examples

For story "Password Reset via Email", tasks:

```
Task 1: Create password reset API endpoint
- POST /api/auth/reset-password-request
- Generate reset token
- Send email
Estimate: 4 hours

Task 2: Build password reset page UI
- React component
- Form validation
- Error handling
Estimate: 3 hours

Task 3: Add email template for reset
- HTML email template
- Configure email service
Estimate: 2 hours

Task 4: Write tests for reset flow
- Unit tests for API
- Integration tests
- E2E test
Estimate: 4 hours
```

## Acceptance Criteria

**Definition:** Conditions that must be met для story быть done.

### Given-When-Then Format (Recommended)

```
Given [context / initial state]
When [action / event]
Then [expected outcome]
And [additional outcome]
But [exception]
```

**Examples:**

```
Feature: User Login

Scenario: Successful login
Given I am on the login page
When I enter valid email and password
Then I am redirected to dashboard
And I see welcome message with my name

Scenario: Invalid credentials
Given I am on the login page
When I enter incorrect password
Then I see error "Invalid credentials"
And I remain on login page
And password field is cleared

Scenario: Account locked
Given my account is locked (5 failed attempts)
When I try to login
Then I see error "Account locked. Reset password to unlock."
And I see link to password reset
```

### Checklist Format (Alternative)

```
Acceptance Criteria:

Functional:
- [ ] User can enter email and password
- [ ] Login successful with valid credentials
- [ ] Error shown for invalid credentials
- [ ] "Remember me" checkbox works
- [ ] "Forgot password" link redirects correctly

UI/UX:
- [ ] Form validates before submission
- [ ] Loading spinner shown during login
- [ ] Error messages are clear and helpful
- [ ] Responsive on mobile/tablet/desktop

Performance:
- [ ] Login completes within 2 seconds
- [ ] Works with slow network (3G)

Security:
- [ ] Password masked by default
- [ ] HTTPS required
- [ ] Account locks after 5 failed attempts
- [ ] Session expires after 30 days (if not "Remember me")
```

### Acceptance Criteria Best Practices

**Do:**
```
✅ Be specific and measurable
✅ Include happy path AND edge cases
✅ Cover functional + non-functional (performance, security)
✅ User perspective (not implementation)
✅ Testable/verifiable
```

**Don't:**
```
❌ Too vague: "Should work well"
❌ Too technical: "Uses JWT tokens"
❌ Missing edge cases
❌ Only happy path
❌ Untestable: "Should be fast"
```

**Examples of Good vs Bad:**

```
❌ Bad: "User can search"
✅ Good: "Given I enter search term, when I click Search,
          then I see results within 3 seconds"

❌ Bad: "Fast response time"
✅ Good: "API responds in <200ms for 95% of requests"

❌ Bad: "Works on mobile"
✅ Good: "UI is responsive and usable on screens ≥320px width"

❌ Bad: "Secure login"
✅ Good: "Password transmitted over HTTPS,
          hashed with bcrypt before storage,
          session expires after 30 minutes"
```

## Refinement Process

**Goal:** Подготовить stories к sprint planning (Definition of Ready).

### Refinement Meeting Structure

```
Duration: 1-2 hours
Frequency: Once per week
Attendees: PO, Dev Lead, Designer, 2-3 Developers

Agenda:
1. Review upcoming stories (next 2-3 sprints)
2. For each story:
   - PO explains context and value
   - Team asks clarifying questions
   - Discuss technical approach
   - Identify dependencies/risks
   - Define acceptance criteria
   - Estimate effort
3. Mark story as "Ready" если meets criteria
```

### Definition of Ready Checklist

Story ready для sprint planning когда:

```
- [ ] Written in user story format
- [ ] Value/benefit clearly stated
- [ ] Acceptance criteria defined (Given-When-Then)
- [ ] Dependencies identified and resolved (или planned)
- [ ] Design/mockups available (if needed)
- [ ] Technical approach discussed (no major unknowns)
- [ ] Estimated by team (story points)
- [ ] Fits within one sprint (≤8 points recommended)
- [ ] No blockers
- [ ] Team has capacity to work on it
```

If story не meets criteria → mark for further refinement.

## Definition of Done

**Definition:** Checklist что должно быть completed для story быть done.

### Template

```markdown
## Definition of Done

### Code Complete
- [ ] All acceptance criteria met
- [ ] Code follows team standards
- [ ] No commented-out code
- [ ] No TODOs/FIXMEs left
- [ ] Logging added where appropriate

### Testing
- [ ] Unit tests written and passing (≥80% coverage)
- [ ] Integration tests passing
- [ ] E2E tests updated (if applicable)
- [ ] Manual testing completed
- [ ] Tested on all supported browsers/devices

### Code Review
- [ ] Pull request created
- [ ] Code reviewed by ≥1 team member
- [ ] All review comments addressed
- [ ] Approved by reviewer

### Quality
- [ ] No new lint errors/warnings
- [ ] Build passes
- [ ] No performance regressions
- [ ] Accessibility checked (WCAG AA)

### Documentation
- [ ] README updated (if needed)
- [ ] API documentation updated
- [ ] Inline comments added for complex logic
- [ ] User-facing docs updated

### Deployment
- [ ] Deployed to staging
- [ ] Smoke tests on staging pass
- [ ] Demo to PO completed
- [ ] PO acceptance received
- [ ] Ready for production deploy

### Cleanup
- [ ] Feature flag added (if new feature)
- [ ] Analytics tracking added
- [ ] Monitoring/alerts configured
- [ ] Branch merged and deleted
```

### Team-Specific DoD

Different teams могут иметь different DoD. Examples:

**Minimal DoD (Early Startup):**
```
- [ ] Feature works as specified
- [ ] Deployed to production
- [ ] PO verified
```

**Enterprise DoD:**
```
- [ ] Code complete and reviewed
- [ ] Automated tests (unit, integration, E2E)
- [ ] Security scan passed
- [ ] Performance tested
- [ ] Accessibility audit passed
- [ ] Documentation complete
- [ ] Deployed via CI/CD
- [ ] Monitoring dashboards updated
- [ ] Runbook created
- [ ] Stakeholder demo completed
```

## Story Splitting Techniques

When story too large (>8 points), split using:

### 1. Workflow Steps

```
Original: "User can checkout"

Split by steps:
1. View cart summary
2. Enter shipping address
3. Select payment method
4. Review order
5. Confirm and pay
```

### 2. Happy Path vs Variations

```
Original: "User can login"

Split:
1. Happy path: successful login
2. Error: invalid credentials
3. Error: account locked
4. Error: password expired
```

### 3. Simple vs Complex

```
Original: "Advanced search with filters"

Split:
1. Basic keyword search
2. Add single filter (e.g., date)
3. Add multiple filters
4. Save search preferences
```

### 4. CRUD Operations

```
Original: "User management"

Split:
1. Create user
2. Read/view user
3. Update user
4. Delete user
```

### 5. Defer Performance

```
Original: "Real-time notifications"

Split:
1. Polling-based notifications (simpler)
2. WebSocket real-time (later)
```

### 6. Platform/Device

```
Original: "Responsive dashboard"

Split:
1. Desktop version
2. Tablet version
3. Mobile version
```

### 7. Spike then Implement

```
Original: "Integrate с third-party API" (uncertain)

Split:
1. Spike: research API, POC (2 points)
2. Implement integration (5 points after spike)
```

## Common Anti-Patterns

**Water-Scrum-Fall:**
```
❌ Writing all stories upfront в detail
✅ High-level epics → refine stories just-in-time

Keep далёкие stories high-level, refine ближайшие.
```

**Technical Tasks as Stories:**
```
❌ "Refactor database layer"
✅ "Improve query performance" (user benefit)

Even tech debt, frame as user value.
```

**No Acceptance Criteria:**
```
❌ "Build feature X" (vague)
✅ Clear Given-When-Then criteria

How знать when done без criteria?
```

**Massive Stories:**
```
❌ 21+ point stories в sprint
✅ Break down to ≤8 points

Large stories = high risk, hard to estimate.
```

**Story Depends on Story:**
```
❌ Story A blocks Story B blocks Story C
✅ Minimize dependencies, или combine stories

Dependencies = complexity, delays.
```

## Templates Summary

### Quick Epic Template
```markdown
# [Epic Name]

Problem: [What problem?]
Value: [Why important?]
Scope: [What's included?]
Success: [How measure?]
Stories: [High-level list]
```

### Quick Story Template
```markdown
# [Story Name]

As a [user]
I want [feature]
So that [benefit]

AC:
Given [state]
When [action]
Then [outcome]

Estimate: [points]
```

### Quick Task Template
```markdown
# [Task Name]

Story: [parent]
What: [description]
Steps: [checklist]
Est: [hours]
```

## Tips for Writing Great Artifacts

1. **User Language**: пишите как users говорят, не как developers
2. **Value First**: всегда start с "why", потом "what"
3. **Specific**: избегайте vague terms ("improve", "better")
4. **Testable**: если can't test, can't verify done
5. **Small Batches**: smaller stories = faster feedback
6. **Collaborative**: пишите вместе с team, не в isolation
7. **Living Documents**: update по мере learning
8. **Visual**: добавляйте mockups, diagrams where helpful
9. **Consistent Format**: используйте templates, team знает что ожидать
10. **Refine Continuously**: ближайшие detailed, дальние high-level

Great artifacts = shared understanding = less waste = faster delivery!
