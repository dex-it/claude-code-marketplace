---
name: user-stories
description: Activate when writing user stories, analyzing requirements for stories, or discussing INVEST criteria and acceptance criteria. Contains best practices for Agile user story writing.
allowed-tools: Read, Write, Edit
---

# User Stories Skill

This skill provides comprehensive knowledge about writing effective user stories for Agile software development, specifically tailored for .NET teams.

## What Are User Stories?

User stories are short, simple descriptions of a feature told from the perspective of the person who desires the new capability (usually a user or customer). They follow the format:

**As a** [role]
**I want** [goal/desire]
**So that** [benefit/value]

## INVEST Criteria

Every good user story must meet INVEST criteria:

### Independent
- Story can be developed in any order
- Minimal dependencies on other stories
- Can be delivered separately
- Team can work on multiple stories in parallel

**Bad Example**: "As a user, I want to add items to cart (depends on 'create cart' story)"
**Good Example**: Each story handles its own scope - cart creation is implicit or part of the story

### Negotiable
- Story is not a contract or detailed specification
- Details emerge through conversation
- Implementation approach can be discussed
- Scope can be refined during development

**Indicator**: Story has "TBD" or "discuss with team" notes

### Valuable
- Delivers clear benefit to user or business
- Stakeholder can explain why it matters
- ROI is understood
- Moves product closer to vision

**Test**: Can you explain the value in one sentence to a non-technical stakeholder?

### Estimable
- Team can estimate complexity/effort
- Story has enough detail to size
- Dependencies and risks are understood
- Technical approach is feasible

**Red Flag**: Team says "we need to research this" or "too many unknowns"

### Small
- Fits within one sprint (typically 1-2 weeks)
- Can be completed by one developer or pair
- Can be demoed at sprint review
- Provides incremental value

**Rule of Thumb**: 1-5 days of work (1, 2, 3, 5, or 8 story points)

### Testable
- Clear acceptance criteria exist
- Success can be objectively verified
- Both manual and automated tests are possible
- Edge cases are identified

**Must Have**: Given-When-Then scenarios or checklist of testable criteria

## User Story Template

```markdown
## [Story ID]: [Action-Oriented Title]

**As a** [specific role/persona]
**I want to** [specific goal/action]
**So that** [clear benefit/value]

### Context
[Optional: Additional background, business justification, or user motivation]

### Acceptance Criteria

#### Scenario 1: [Primary/Happy Path Scenario]
**Given** [initial context or preconditions]
**When** [action or event occurs]
**Then** [expected outcome or result]

#### Scenario 2: [Alternative Path or Error Scenario]
**Given** [different context]
**When** [different action]
**Then** [different outcome]

### Checklist
- [ ] Specific, testable criterion 1
- [ ] Specific, testable criterion 2
- [ ] Specific, testable criterion 3
- [ ] Error handling for [specific error]
- [ ] Validation for [specific input]
- [ ] Performance: [specific metric]

### Technical Notes

**API Endpoints:**
- [HTTP METHOD] /api/[resource] - [description]

**Database Changes:**
- [Migration name or schema changes]

**Dependencies:**
- [External systems, libraries, or other stories]

**Security Considerations:**
- [Authentication, authorization, data protection]

**Performance Requirements:**
- [Response time, throughput, resource usage]

### Definition of Done
- [ ] Code implemented following team standards
- [ ] Code reviewed and approved
- [ ] Unit tests written (minimum 80% coverage)
- [ ] Integration tests written for API endpoints
- [ ] All tests passing in CI/CD pipeline
- [ ] API documented in Swagger/OpenAPI
- [ ] Security review completed (if applicable)
- [ ] Performance tested against requirements
- [ ] Deployed to test environment
- [ ] QA verified all acceptance criteria
- [ ] Product Owner accepted the story
- [ ] Documentation updated

### Metadata
- **Story Points**: [1, 2, 3, 5, 8]
- **Priority**: Must Have / Should Have / Could Have / Won't Have
- **Sprint**: Sprint [number]
- **Epic**: [Link to parent epic]
- **Dependencies**: [Links to blocking stories]
- **Tags**: [feature-area, component, etc.]
```

## Writing Effective Acceptance Criteria

### Gherkin Format (Given-When-Then)

**Structure**:
```
Given [precondition/context]
And [additional context]
When [action/event]
And [additional action]
Then [expected outcome]
And [additional outcome]
```

**Example**:
```
Scenario: User successfully logs in with valid credentials

Given I am on the login page
And I have a registered account
When I enter my email "user@example.com"
And I enter my password "SecurePass123"
And I click the "Login" button
Then I should be redirected to the dashboard
And I should see a welcome message "Welcome back, John"
And my session should be active for 30 minutes
```

### Checklist Format

Use when Given-When-Then is too verbose:

```markdown
### Acceptance Criteria
- [ ] User can enter email and password
- [ ] Login button is disabled until both fields are filled
- [ ] Clicking Login sends POST request to /api/auth/login
- [ ] Valid credentials redirect to dashboard
- [ ] Invalid credentials show error message
- [ ] Error message is "Invalid email or password"
- [ ] Login attempts are rate-limited (3 attempts per 15 min)
- [ ] Session token expires after 30 minutes
- [ ] "Remember me" checkbox extends session to 30 days
- [ ] Failed login attempts are logged
```

### Covering All Scenarios

Ensure acceptance criteria cover:

1. **Happy Path**: Normal, expected usage
2. **Alternative Paths**: Valid variations
3. **Error Cases**: Invalid input, missing data
4. **Edge Cases**: Boundary conditions, limits
5. **Security**: Authentication, authorization, data protection
6. **Performance**: Response time, load handling
7. **Usability**: User feedback, accessibility

## Story Splitting Techniques

When a story is too large (>8 story points), split it:

### 1. By Workflow Steps
Break multi-step process into separate stories:
- Story 1: User can create account
- Story 2: User receives verification email
- Story 3: User verifies email address
- Story 4: User completes profile setup

### 2. By Business Rules
Split complex logic:
- Story 1: Calculate shipping for domestic orders
- Story 2: Calculate shipping for international orders
- Story 3: Apply free shipping discount
- Story 4: Handle oversized items

### 3. By Data Variations
Split by different data types or scenarios:
- Story 1: Import users from CSV file
- Story 2: Import users from Excel file
- Story 3: Import users from JSON API

### 4. By CRUD Operations
Split by database operations:
- Story 1: Create product (POST)
- Story 2: Read product (GET)
- Story 3: Update product (PUT/PATCH)
- Story 4: Delete product (DELETE)

### 5. By Simple/Complex
Start with simple version, enhance later:
- Story 1: Basic search by product name
- Story 2: Add filters (category, price range)
- Story 3: Add sorting options
- Story 4: Add full-text search with highlighting

### 6. By Priority/Value
Split by must-have vs nice-to-have:
- Story 1: User can reset password (must-have)
- Story 2: User can use password strength indicator (nice-to-have)

## Common Mistakes to Avoid

### 1. Too Technical
**Bad**: "Implement Repository pattern for User entity"
**Good**: "As a developer, I want consistent data access methods so that code is maintainable"

### 2. Too Vague
**Bad**: "As a user, I want a better search"
**Good**: "As a user, I want to filter products by price range so that I can find items within my budget"

### 3. No Clear Value
**Bad**: "As a user, I want a settings page"
**Good**: "As a user, I want to customize notification preferences so that I only receive relevant alerts"

### 4. Too Large
**Bad**: "As a user, I want a complete e-commerce checkout flow"
**Good**: Break into: view cart, enter shipping, enter payment, review order, confirm order

### 5. Missing Acceptance Criteria
**Bad**: Story has no AC or vague criteria like "works correctly"
**Good**: Specific, testable criteria for each scenario

### 6. Implementation Details in Description
**Bad**: "As a user, I want data cached in Redis so that pages load faster"
**Good**: "As a user, I want pages to load in under 2 seconds so that I have a smooth experience"
(Redis implementation goes in Technical Notes)

## .NET-Specific Story Patterns

### API Endpoint Story
```markdown
## User Story: Retrieve User Profile via API

**As an** API consumer
**I want to** retrieve user profile information
**So that** I can display user details in my application

### Acceptance Criteria
- [ ] Endpoint: GET /api/users/{id}
- [ ] Returns 200 with UserProfileDto on success
- [ ] Returns 404 if user not found
- [ ] Returns 401 if not authenticated
- [ ] Requires Bearer token authentication
- [ ] Response time < 500ms
- [ ] Response includes: id, email, firstName, lastName, createdAt
- [ ] Sensitive data (password hash) is not exposed

### Technical Notes
**Endpoint**: GET /api/users/{id}
**Response Schema**:
\`\`\`csharp
public class UserProfileDto
{
    public int Id { get; set; }
    public string Email { get; set; }
    public string FirstName { get; set; }
    public string LastName { get; set; }
    public DateTime CreatedAt { get; set; }
}
\`\`\`
```

### Database Migration Story
```markdown
## User Story: Store User Preferences

**As a** user
**I want** my preferences to be saved
**So that** they persist across sessions

### Acceptance Criteria
- [ ] User preferences are saved to database
- [ ] Preferences include: theme, language, timezone
- [ ] Preferences are loaded on login
- [ ] Changing preferences updates database immediately
- [ ] Default preferences are applied for new users

### Technical Notes
**Migration**: AddUserPreferencesTable
**Entity**: UserPreferences
**Relationship**: One-to-One with User
```

### Background Job Story
```markdown
## User Story: Automated Daily Reports

**As an** administrator
**I want** daily reports generated automatically
**So that** I don't have to create them manually

### Acceptance Criteria
- [ ] Report runs daily at 6:00 AM UTC
- [ ] Report includes data from previous 24 hours
- [ ] Report is saved as PDF
- [ ] Report is emailed to admin list
- [ ] Failed report generation triggers alert
- [ ] Job can be manually triggered from admin panel

### Technical Notes
**Scheduler**: Hangfire
**Cron**: 0 6 * * * (daily at 6 AM)
**Dependencies**: PDF generation library, SMTP service
```

## Story Prioritization

Use MoSCoW method:

- **Must Have**: Critical for release, non-negotiable
- **Should Have**: Important but not critical
- **Could Have**: Desirable if time permits
- **Won't Have**: Not in this release, deferred

## Estimating Story Points

Story points represent complexity, not time:

- **1 point**: Trivial, well-understood, couple hours
- **2 points**: Simple, clear approach, half day
- **3 points**: Moderate, some complexity, 1 day
- **5 points**: Complex, multiple components, 2-3 days
- **8 points**: Very complex, might need splitting, 5+ days
- **13+ points**: Epic, must be broken down

## Story Review Checklist

Before accepting a story, verify:

- [ ] Follows standard format (As a... I want... So that...)
- [ ] Meets all INVEST criteria
- [ ] Has specific, testable acceptance criteria
- [ ] Includes both happy path and error scenarios
- [ ] Has appropriate technical notes
- [ ] Has clear Definition of Done
- [ ] Is right-sized (1-8 story points)
- [ ] Dependencies are identified
- [ ] Priority is assigned
- [ ] Estimated by the team

## Tips for System Analysts

1. **Collaborate**: Write stories with developers, testers, and product owners
2. **Refine Continuously**: Stories evolve through backlog refinement
3. **Ask Questions**: Clarify ambiguities before sprint starts
4. **Think Testability**: Write criteria that QA can verify
5. **Include Examples**: Concrete examples clarify requirements
6. **Link Stories**: Show relationships and dependencies
7. **Update Stories**: Reflect learnings and changes
8. **Archive Old Stories**: Keep backlog clean and relevant

Remember: A user story is a promise for a conversation, not a complete specification. The goal is to have just enough detail to start work and trigger meaningful discussions during development.
